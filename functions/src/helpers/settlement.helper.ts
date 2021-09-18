import {
    Balance,
    House,
    Product,
    ProductData,
    HouseSettleMap,
    UserAccount,
    HouseSettlement,
} from '../models';
import * as functions from 'firebase-functions';
import {ErrorMessage} from '../models/error-message';
import * as admin from 'firebase-admin';

export interface AccountBalanceMap {
    [accountId: string]: {
        newBalance: number,
        oldBalance: number,
        straighten: number,
        products: {
            [productId: string]: ProductData,
        };
    };
}

export interface ProductBalanceMap {
    [productId: string]: {
        [accountId: string]: {
            percentageIn: number,
            amountIn?: number,
            totalIn?: number,
        },
    };
}


export function calculateNewBalance(house: House): AccountBalanceMap {
    const newAccountBalances: AccountBalanceMap = {};
    const newProductBalances: ProductBalanceMap = {};

    house.accounts.forEach((account: UserAccount) => {
        const accountBalance: Balance = house.balances[account.id];

        const newBalance = {
            newBalance: 0,
            oldBalance: 0,
            straighten: 0,
            products: {},
        };

        // Iterate through every product this account has interacted with
        if (accountBalance.products) {
            Object.keys(accountBalance.products).forEach((productId: string) => {
                const product: Product | undefined = house.products.find((p: any) => p.id === productId);
                const pData: ProductData | undefined = house.productData[productId];

                if (!product || !pData) {
                    throw new functions.https.HttpsError('not-found', ErrorMessage.PRODUCT_NOT_FOUND);
                }

                const totalAmountIn: number = pData.amountIn;

                const currentEstimatedWorth = (pData.amountIn - pData.amountOut) * product.price;
                const worthDifference = (pData.totalIn - pData.totalOut) - currentEstimatedWorth;
                const restWorth = Math.round((worthDifference
                    * (pData.amountIn !== 0 ? 1 - (pData.amountOut / pData.amountIn) : 0))
                    + currentEstimatedWorth);

                // Safe guard for dividing by 0
                if (totalAmountIn > 0) {
                    const updatedBalance: number =
                        Math.floor(restWorth
                            * (accountBalance.products?.[productId].amountIn || 0) / totalAmountIn);
                    const productWorthDifference: number =
                        -Math.floor(worthDifference * (accountBalance.products?.[productId].amountOut || 0) / totalAmountIn);

                    newBalance.newBalance += updatedBalance;
                    newBalance.straighten += productWorthDifference;

                    if (!newProductBalances[productId]) {
                        newProductBalances[productId] = {};
                    }

                    if (accountBalance.products?.[productId].amountIn) {
                        newProductBalances[productId][account.id] = {
                            percentageIn: Math.fround(accountBalance.products[productId].amountIn / totalAmountIn),
                        };
                    }
                }
            });
        }

        const amount: number = accountBalance.totalIn - accountBalance.totalOut;
        newBalance.oldBalance += amount;

        newAccountBalances[account.id] = newBalance;
    });

    Object.keys(newProductBalances).forEach((productId: string) => {
        const product: Product | undefined = house.products.find((pr: { id: string }) => pr.id === productId);
        const pData: ProductData | undefined = house.productData[productId];

        if (!product || !pData) {
            throw new functions.https.HttpsError('not-found', ErrorMessage.PRODUCT_NOT_FOUND);
        }

        const currentEstimatedWorth = (pData.amountIn - pData.amountOut) * product.price;
        const worthDifference = (pData.totalIn - pData.totalOut) - currentEstimatedWorth;
        const restWorth = Math.round((worthDifference
            * (pData.amountIn !== 0 ? 1 - pData.amountOut / pData.amountIn : 0))
            + currentEstimatedWorth);

        const productData: ProductData = {
            totalIn: restWorth,
            totalOut: 0,
            amountIn: (pData.amountIn - pData.amountOut),
            amountOut: 0,
        };

        let newAmountInSum = 0;
        let newTotalInSum = 0;

        Object.keys(newProductBalances[productId]).forEach((accountId: string) => {
            const newAmountIn: number
                = Math.floor((newProductBalances[productId][accountId].percentageIn * productData.amountIn)
                * 100) / 100;
            const newTotalIn: number
                = Math.floor(newProductBalances[productId][accountId].percentageIn * productData.totalIn);

            newProductBalances[productId][accountId].amountIn = newAmountIn;
            newProductBalances[productId][accountId].totalIn = newTotalIn;

            newAmountInSum += newAmountIn;
            newTotalInSum += newTotalIn;
        });

        // Calculate the remainder with 2 decimal accuracy for the amount
        let amountRemainder = Math.round((productData.amountIn * 100) - (newAmountInSum * 100));
        let totalRemainder = Math.round(productData.totalIn - newTotalInSum);

        const accountKeys: string[] = Object.keys(newProductBalances[productId]);
        for (let i = 0; amountRemainder > 0; i = ((i + 1) % accountKeys.length), amountRemainder--) {
            // @ts-ignore
            newProductBalances[productId][accountKeys[i]].amountIn += 0.01;
        }

        for (let i = 0; totalRemainder > 0; i = ((i + 1) % accountKeys.length), totalRemainder--) {
            // @ts-ignore
            newProductBalances[productId][accountKeys[i]].totalIn += 1;
        }
    });

    let settleRemainder = 0;
    Object.keys(newAccountBalances).forEach((accountId: string) => {
        const acc = newAccountBalances[accountId];
        settleRemainder += acc.oldBalance - acc.newBalance + acc.straighten;
    });

    let settleRemainderAbs = Math.abs(settleRemainder);
    const accKeys: string[] = Object.keys(newAccountBalances);
    for (let i = 0; settleRemainderAbs > 0; i = ((i + 1) % accKeys.length), settleRemainderAbs--) {
        // @ts-ignore
        newAccountBalances[accKeys[i]].straighten += settleRemainder < 0 ? 1 : -1;
    }

    Object.keys(newAccountBalances).forEach((accountId: string) => {
        Object.keys(newProductBalances).forEach((productId: string) => {
            Object.keys(newProductBalances[productId]).filter((key: string) =>
                key === accountId).forEach((_: string) => {
                if (!newAccountBalances[accountId].products[productId]) {
                    newAccountBalances[accountId].products[productId] = {
                        amountIn: 0,
                        amountOut: 0,
                        totalIn: 0,
                        totalOut: 0,
                    } as ProductData;
                }


                newAccountBalances[accountId].products[productId].amountIn // @ts-ignore
                    += newProductBalances[productId][accountId].amountIn;
                // @ts-ignore
                newAccountBalances[accountId].products[productId].totalIn // @ts-ignore
                    += newProductBalances[productId][accountId].totalIn;
            });
        });
    });

    return newAccountBalances;
}

export function deriveUpdateBatch(house: House, newAccountBalances: AccountBalanceMap): { [updateKey: string]: unknown } {
    const updateBatch: any = {
        isSettling: false,
        settledAt: admin.firestore.FieldValue.serverTimestamp(),
        totalIn: 0,
        totalOut: 0,
    };

    house.accounts.forEach((account: { id: string }) => {
        const balance = newAccountBalances[account.id];
        if (balance) {
            updateBatch[`balances.${account.id}`] = {
                totalIn: balance.newBalance,
                totalOut: 0,
                products: balance.products,
            };

            updateBatch.totalIn += balance.newBalance;
        } else {
            updateBatch[`balances.${account.id}`] = {
                totalIn: 0,
                totalOut: 0,
            };
        }
    });

    Object.keys(newAccountBalances).forEach((accountId: string) => {
        Object.keys(newAccountBalances[accountId].products).forEach((productId: string) => {
            if (!updateBatch[`productData.${productId}`]) {
                const pData: ProductData | undefined = house.productData[productId];
                updateBatch[`productData.${productId}`] = {
                    totalIn: 0,
                    totalOut: 0,
                    amountIn: (pData.amountIn - pData.amountOut),
                    amountOut: 0,
                };
            }

            updateBatch[`productData.${productId}`].totalIn += newAccountBalances[accountId].products[productId].totalIn;
        });
    });

    return updateBatch;
}

export function calculateHouseSettlement(house: House, userId: string, newAccountBalances: AccountBalanceMap): HouseSettlement {
    let toSettle: {
        accountId: string,
        settle: number,
    }[] = [];

    const settled: HouseSettleMap = {};

    Object.keys(newAccountBalances).forEach((accountId: string) => {
        const settleAmount = newAccountBalances[accountId].oldBalance
            + newAccountBalances[accountId].straighten - newAccountBalances[accountId].newBalance;

        toSettle.push({
            accountId,
            settle: settleAmount,
        });

        settled[accountId] = {
            settle: settleAmount,
            receives: {},
            owes: {},
        };
    });

    toSettle = toSettle.sort(((a, b) => a.settle > b.settle ? 1 : -1));

    let low;
    let high;
    for (low = 0, high = toSettle.length - 1; low < high;) {
        const lowest = toSettle[low];
        const highest = toSettle[high];

        if (lowest.settle >= 0) {
            break;
        }

        // Highest value cannot fully cover the lowest.
        if (highest.settle + lowest.settle < 0) {
            settled[highest.accountId].receives[lowest.accountId] = highest.settle;
            settled[lowest.accountId].owes[highest.accountId] = highest.settle;
            lowest.settle += highest.settle;
            high--;
        } else { // Highest value can fully cover the lowest
            settled[highest.accountId].receives[lowest.accountId] = Math.abs(lowest.settle);
            settled[lowest.accountId].owes[highest.accountId] = Math.abs(lowest.settle);
            highest.settle += lowest.settle;
            low++;
        }
    }

    const currentAccount: UserAccount | undefined
        = house.accounts.find((account: UserAccount) => account.userId === userId);

    if (!currentAccount) {
        throw new functions.https.HttpsError('not-found', ErrorMessage.USER_ACCOUNT_NOT_FOUND);
    }

    const settlement: HouseSettlement = {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: currentAccount.id,
        items: settled,
        accounts: {},
        type: 'house',
    };

    house.accounts.forEach((acc: UserAccount) => {
        settlement.accounts[acc.id] = {
            name: acc.name,
        };
    });

    return settlement;
}
