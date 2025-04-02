;; Investor Distribution Contract
;; This contract allocates returns to capital providers

(define-data-var contract-owner principal tx-sender)

;; Data map for investments
(define-map investments
  { investment-id: (string-ascii 36) }
  {
    loan-id: (string-ascii 36),
    investor: principal,
    amount: uint,
    share-percentage: uint,  ;; basis points (e.g., 5000 = 50%)
    total-distributed: uint,
    status: (string-ascii 20)  ;; "active", "completed", "defaulted"
  }
)

;; Data map for distributions
(define-map distributions
  { distribution-id: (string-ascii 36) }
  {
    investment-id: (string-ascii 36),
    amount: uint,
    block-height: uint,
    recipient: principal
  }
)

;; Error codes
(define-constant ERR_UNAUTHORIZED u1)
(define-constant ERR_NOT_FOUND u2)
(define-constant ERR_INVALID_INPUT u3)
(define-constant ERR_INVESTMENT_NOT_ACTIVE u4)
(define-constant ERR_INSUFFICIENT_FUNDS u5)

;; Initialize contract
(define-public (initialize)
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR_UNAUTHORIZED))
    (ok true)
  )
)

;; Create a new investment
(define-public (create-investment
    (investment-id (string-ascii 36))
    (loan-id (string-ascii 36))
    (amount uint)
    (share-percentage uint))
  (begin
    (asserts! (> amount u0) (err ERR_INVALID_INPUT))
    (asserts! (and (> share-percentage u0) (<= share-percentage u10000)) (err ERR_INVALID_INPUT))
    (asserts! (is-none (map-get? investments { investment-id: investment-id })) (err ERR_INVALID_INPUT))

    (map-set investments
      { investment-id: investment-id }
      {
        loan-id: loan-id,
        investor: tx-sender,
        amount: amount,
        share-percentage: share-percentage,
        total-distributed: u0,
        status: "active"
      }
    )
    (ok true)
  )
)

;; Distribute returns to an investor
(define-public (distribute-returns
    (distribution-id (string-ascii 36))
    (investment-id (string-ascii 36))
    (amount uint))
  (let (
    (investment (unwrap! (map-get? investments { investment-id: investment-id }) (err ERR_NOT_FOUND)))
  )
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR_UNAUTHORIZED))
    (asserts! (is-eq (get status investment) "active") (err ERR_INVESTMENT_NOT_ACTIVE))
    (asserts! (> amount u0) (err ERR_INVALID_INPUT))

    ;; Record the distribution
    (map-set distributions
      { distribution-id: distribution-id }
      {
        investment-id: investment-id,
        amount: amount,
        block-height: block-height,
        recipient: (get investor investment)
      }
    )

    ;; Update the investment with the new total distributed
    (let ((new-total-distributed (+ (get total-distributed investment) amount)))
      (map-set investments
        { investment-id: investment-id }
        (merge investment {
          total-distributed: new-total-distributed
        })
      )
    )

    (ok true)
  )
)

;; Mark an investment as completed
(define-public (mark-investment-completed (investment-id (string-ascii 36)))
  (let ((investment (unwrap! (map-get? investments { investment-id: investment-id }) (err ERR_NOT_FOUND))))
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR_UNAUTHORIZED))
    (asserts! (is-eq (get status investment) "active") (err ERR_INVESTMENT_NOT_ACTIVE))

    (map-set investments
      { investment-id: investment-id }
      (merge investment { status: "completed" })
    )
    (ok true)
  )
)

;; Mark an investment as defaulted
(define-public (mark-investment-defaulted (investment-id (string-ascii 36)))
  (let ((investment (unwrap! (map-get? investments { investment-id: investment-id }) (err ERR_NOT_FOUND))))
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR_UNAUTHORIZED))
    (asserts! (is-eq (get status investment) "active") (err ERR_INVESTMENT_NOT_ACTIVE))

    (map-set investments
      { investment-id: investment-id }
      (merge investment { status: "defaulted" })
    )
    (ok true)
  )
)

;; Get investment details
(define-read-only (get-investment-details (investment-id (string-ascii 36)))
  (let ((investment (map-get? investments { investment-id: investment-id })))
    (if (is-some investment)
      (ok (unwrap! investment (err ERR_NOT_FOUND)))
      (err ERR_NOT_FOUND)
    )
  )
)

;; Get distribution details
(define-read-only (get-distribution-details (distribution-id (string-ascii 36)))
  (let ((distribution (map-get? distributions { distribution-id: distribution-id })))
    (if (is-some distribution)
      (ok (unwrap! distribution (err ERR_NOT_FOUND)))
      (err ERR_NOT_FOUND)
    )
  )
)

;; Calculate expected returns for an investment
(define-read-only (calculate-expected-returns (investment-id (string-ascii 36)))
  (let (
    (investment (unwrap! (map-get? investments { investment-id: investment-id }) (err ERR_NOT_FOUND)))
    (principal-amount (get amount investment))
    (share-percentage (get share-percentage investment))
  )
    ;; Simple calculation: principal + (principal * share-percentage / 10000)
    (ok (+ principal-amount (/ (* principal-amount share-percentage) u10000)))
  )
)
