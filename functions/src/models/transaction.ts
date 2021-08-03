export interface TransactionItem {
    accountId: string;
    amount: number;
    productId: string;
    productPrice: number;
}

export interface Transaction {
    readonly id: string; // Exists at client side
    createdAt: any;
    createdBy: string;
    items: TransactionItem[];
    removed: boolean;
}
