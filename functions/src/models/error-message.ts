export enum ErrorMessage {
    // GENERAL
    INTERNAL = 'errors.functions.internal',
    UNAUTHENTICATED = 'errors.functions.unauthenticated',
    PERMISSION_DENIED = 'errors.functions.permission_denied',
    INVALID_DATA = 'errors.functions.invalid_data',

    // HOUSES
    HOUSE_NOT_FOUND = 'errors.functions.house_not_found',
    USER_ACCOUNT_NOT_FOUND = 'errors.functions.user_account_not_found',
    SHARED_ACCOUNT_NOT_FOUND = 'errors.functions.shared_account_not_found',
    PRODUCT_NOT_FOUND = 'errors.functions.product_not_found',
    NOT_MEMBER_OF_HOUSE = 'errors.functions.house_not_member',
    ALREADY_MEMBER_OF_HOUSE = 'errors.functions.house_already_member',
    NOT_ADMIN_OF_HOUSE= 'errors.functions.house_not_admin',
    HOUSE_LEAVE_DENIED = 'errors.functions.house_leave_denied',
    INVALID_HOUSE_CODE = 'errors.functions.house_code_invalid',
    EXPIRED_HOUSE_CODE = 'errors.functions.house_code_expired',

    // STOCKS
    STOCK_NOT_FOUND = 'errors.functions.stock_not_found',

    // TRANSACTIONS
    TRANSACTION_NOT_FOUND = 'errors.functions.transaction_not_found',
    ACCOUNT_ALREADY_SETTLED = 'errors.functions.account_already_settled',
}
