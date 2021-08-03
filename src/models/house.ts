export interface House {
    readonly id: string;
    createdAt: any;
    name: string;
    currency: 'EUR';
    inviteLink: string;
    inviteLinkExpiry: any;

    members: string[];
    accounts: UserAccount[];
    sharedAccounts: SharedAccount[];
    products: Product[];

    settledAt?: any;
    isSettling?: boolean;
    settleTimeout?: any;

    totalIn: number;
    totalOut: number;

    productData: {
        [productId: string]: ProductData;
    };

    balances: {
        [accountId: string]: Balance;
    };
}

export interface Account {
    id: string;
    createdAt: any;
    name: string;
    settledAt?: any;
    type: 'user' | 'shared';
}

export interface UserAccount extends Account {
    userId: string;
    roles: string[];
    photoUrl: string;
}

export interface SharedAccount extends Account {
    empty?: string;
}

export interface Product {
    id: string;
    createdAt: any;
    name: string;
    price: number;
}

export interface Balance {
    totalIn: number;
    totalOut: number;
    products?: {
        [productId: string]: ProductData;
    };
}

export interface ProductData {
    amountIn: number;
    amountOut: number;
    totalIn: number;
    totalOut: number;
}
