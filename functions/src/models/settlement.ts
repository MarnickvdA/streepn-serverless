import {Balance} from "./house";

export interface HouseSettleMap {
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

export interface AccountSettleMap {
    totalIn?: number;
    totalOut: number;
    products: {
        [productId: string]: {
            totalIn?: number;
            totalOut: number;
            amountIn?: number;
            amountOut: number;
        };
    };
}

export type SettlementType = 'house' | 'sharedAccount' | 'userAccount';

export interface Settlement {
    createdAt: any;
    createdBy: string;
    type: SettlementType;
    accounts: {
        [accountId: string]: {
            name: string;
        };
    };
}

export interface HouseSettlement extends Settlement {
    items: HouseSettleMap;
}

export interface SharedAccountSettlement extends Settlement {
    settledAtBefore: any;
    creditor: Balance;
    creditorId: string;
    debtors: {
        [id: string]: AccountSettleMap
    }
}

export interface UserAccountSettlement extends Settlement {
    settledAtBefore: any;
    settlerAccountId: string;
    receiverAccountId: string;
    balanceSettled: Balance;
}