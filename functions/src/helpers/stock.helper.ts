import {Stock} from '../models';

const {FieldValue} = require("firebase-admin/firestore");

export function getDeltaStock(originalStock: Stock, updatedStock: Stock) {
    return {
        id: originalStock.id,
        createdAt: originalStock.createdAt,
        createdBy: originalStock.createdBy,
        paidById: originalStock.paidById,
        productId: originalStock.productId,
        cost: originalStock.paidById !== updatedStock.paidById ? -originalStock.cost : updatedStock.cost - originalStock.cost,
        amount: originalStock.productId !== updatedStock.productId ? -originalStock.amount : updatedStock.amount - originalStock.amount,
    } as Stock;
}

export function getHouseUpdateDataIn(stock: Stock) {
    return getHouseUpdateData(stock, 'In');
}

export function getHouseUpdateDataOut(stock: Stock) {
    return getHouseUpdateData(stock, 'Out');
}

function getHouseUpdateData(stock: Stock, direction: 'In' | 'Out') {
    return {
        totalIn: FieldValue.increment(stock.cost),
        [`productData.${stock.productId}.total${direction}`]: FieldValue.increment(stock.cost),
        [`productData.${stock.productId}.amount${direction}`]: FieldValue.increment(stock.amount),
        [`balances.${stock.paidById}.total${direction}`]: FieldValue.increment(stock.cost),
        [`balances.${stock.paidById}.products.${stock.productId}.total${direction}`]:
            FieldValue.increment(stock.cost),
        [`balances.${stock.paidById}.products.${stock.productId}.amount${direction}`]:
            FieldValue.increment(stock.amount),
    };
}
