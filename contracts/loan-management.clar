;; Loan Management Contract
;; This contract handles loan terms and repayment schedules

(define-data-var contract-owner principal tx-sender)

;; Data map for loans
(define-map loans
  { loan-id: (string-ascii 36) }
  {
    business-id: (string-ascii 36),
    amount: uint,
    interest-rate: uint,  ;; basis points (e.g., 500 = 5%)
    term-length: uint,    ;; in blocks
    start-block: uint,
    end-block: uint,
    total-repaid: uint,
    status: (string-ascii 20),  ;; "active", "repaid", "defaulted"
    borrower: principal
  }
)

;; Data map for repayments
(define-map repayments
  { loan-id: (string-ascii 36), repayment-id: uint }
  {
    amount: uint,
    block-height: uint,
    payer: principal
  }
)

;; Counter for repayment IDs
(define-data-var repayment-counter uint u0)

;; Error codes
(define-constant ERR_UNAUTHORIZED u1)
(define-constant ERR_NOT_FOUND u2)
(define-constant ERR_INVALID_INPUT u3)
(define-constant ERR_LOAN_NOT_ACTIVE u4)

;; Initialize contract
(define-public (initialize)
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR_UNAUTHORIZED))
    (ok true)
  )
)

;; Create a new loan
(define-public (create-loan
    (loan-id (string-ascii 36))
    (business-id (string-ascii 36))
    (amount uint)
    (interest-rate uint)
    (term-length uint))
  (begin
    (asserts! (> amount u0) (err ERR_INVALID_INPUT))
    (asserts! (>= interest-rate u0) (err ERR_INVALID_INPUT))
    (asserts! (> term-length u0) (err ERR_INVALID_INPUT))
    (asserts! (is-none (map-get? loans { loan-id: loan-id })) (err ERR_INVALID_INPUT))

    (map-set loans
      { loan-id: loan-id }
      {
        business-id: business-id,
        amount: amount,
        interest-rate: interest-rate,
        term-length: term-length,
        start-block: block-height,
        end-block: (+ block-height term-length),
        total-repaid: u0,
        status: "active",
        borrower: tx-sender
      }
    )
    (ok true)
  )
)

;; Make a loan repayment
(define-public (make-repayment (loan-id (string-ascii 36)) (amount uint))
  (let (
    (loan (unwrap! (map-get? loans { loan-id: loan-id }) (err ERR_NOT_FOUND)))
    (repayment-id (var-get repayment-counter))
  )
    (asserts! (is-eq (get status loan) "active") (err ERR_LOAN_NOT_ACTIVE))
    (asserts! (> amount u0) (err ERR_INVALID_INPUT))

    ;; Record the repayment
    (map-set repayments
      { loan-id: loan-id, repayment-id: repayment-id }
      {
        amount: amount,
        block-height: block-height,
        payer: tx-sender
      }
    )

    ;; Update the loan with the new total repaid
    (let ((new-total-repaid (+ (get total-repaid loan) amount)))
      (map-set loans
        { loan-id: loan-id }
        (merge loan {
          total-repaid: new-total-repaid,
          status: (if (>= new-total-repaid (get amount loan)) "repaid" (get status loan))
        })
      )
    )

    ;; Increment the repayment counter
    (var-set repayment-counter (+ repayment-id u1))

    (ok true)
  )
)

;; Mark a loan as defaulted (only contract owner can do this)
(define-public (mark-loan-defaulted (loan-id (string-ascii 36)))
  (let ((loan (unwrap! (map-get? loans { loan-id: loan-id }) (err ERR_NOT_FOUND))))
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR_UNAUTHORIZED))
    (asserts! (is-eq (get status loan) "active") (err ERR_LOAN_NOT_ACTIVE))

    (map-set loans
      { loan-id: loan-id }
      (merge loan { status: "defaulted" })
    )
    (ok true)
  )
)

;; Get loan details
(define-read-only (get-loan-details (loan-id (string-ascii 36)))
  (let ((loan (map-get? loans { loan-id: loan-id })))
    (if (is-some loan)
      (ok (unwrap! loan (err ERR_NOT_FOUND)))
      (err ERR_NOT_FOUND)
    )
  )
)

;; Get repayment details
(define-read-only (get-repayment-details (loan-id (string-ascii 36)) (repayment-id uint))
  (let ((repayment (map-get? repayments { loan-id: loan-id, repayment-id: repayment-id })))
    (if (is-some repayment)
      (ok (unwrap! repayment (err ERR_NOT_FOUND)))
      (err ERR_NOT_FOUND)
    )
  )
)

;; Calculate remaining amount due
(define-read-only (calculate-remaining-amount (loan-id (string-ascii 36)))
  (let (
    (loan (unwrap! (map-get? loans { loan-id: loan-id }) (err ERR_NOT_FOUND)))
    (principal-amount (get amount loan))
    (interest-amount (/ (* principal-amount (get interest-rate loan)) u10000))
    (total-due (+ principal-amount interest-amount))
  )
    (ok (- total-due (get total-repaid loan)))
  )
)
