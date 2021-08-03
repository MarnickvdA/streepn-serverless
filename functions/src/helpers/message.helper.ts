import {House, Transaction} from '../models';
import * as admin from 'firebase-admin';

export function sendNotification(topic: string, title: string, body: string, data: { [key: string]: string }) {
    try {
        const message = {
            notification: {
                title,
                body,
            },
            data: {
                houseId: data.houseId ?? '',
            },
            topic,
        };

        admin.messaging().send(message)
            .catch((error) => {
                console.error('Error sending message:', error);
            });
    } catch (e) {
        console.error(e);
    }
}

export function sendTransactionAdded(house: House, transaction: Transaction) {
    const topic = `house_${house.id}_all`;

    const title = `Nieuwe transactie in ${house.name}`;
    const message = `${house.accounts.find(acc => acc.id === transaction.createdBy)?.name}` +
        ` heeft ${getItemStrings(house, transaction).join(', ')} gestreept voor ${getMoneyString(getTransactionSum(transaction), house.currency)}`;

    sendNotification(topic, title, message, {
        houseId: house.id,
    });
}

export function getTransactionSum(transaction: Transaction): number {
    let sum = 0;

    transaction.items.forEach(item => {
        sum += item.amount * item.productPrice;
    });

    return sum;
}

export function getItemStrings(house: House, transaction: Transaction): string[] {
    const items: string[] = [];

    transaction.items.forEach(item => {
        items.push(`${item.amount}x ${house.products.find(p => p.id === item.productId)?.name}`);
    });

    return items;
}

export function getMoneyString(money: number, currency: string): string {
    return Intl.NumberFormat('nl-NL', {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
    }).format(money / 100);
}
