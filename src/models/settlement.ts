export interface SettleMap {
    [accountId: string]: {
        settle: number;
        owes: {
            [accountId: string]: number;
        };
        receives: {
            [accountId: string]: number;
        };
    };
}

export interface Settlement {
    createdAt: any;
    createdBy: string;
    accounts: {
        [accountId: string]: {
            name: string;
        };
    };
    items: SettleMap;
}
