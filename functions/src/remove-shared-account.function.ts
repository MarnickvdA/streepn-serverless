import * as functions from 'firebase-functions';
import {Balance, House} from './models';
import {ErrorMessage} from './models/error-message';

const {FieldValue, getFirestore} = require("firebase-admin/firestore");
const db = getFirestore();

interface RemoveSharedAccountData {
    houseId: string;
    sharedAccountId: string;
}

/**
 * removeSharedAccount
 *
 * HTTP Trigger function for removing shared account from a house. This function checks if the user is allowed to do this operation.
 *
 * @var houseId: string
 * @var sharedAccountId: string
 *
 * @returns void
 * @throws UNAUTHENTICATED if the initiator of this call is not authenticated with Firebase Auth
 * @throws PERMISSION_DENIED if this user is not allowed to do operations
 * @throws INTERNAL if something went wrong which we cannot completely explain
 * @throws HOUSE_NOT_FOUND if the house with variable houseId was not found
 * @throws NOT_MEMBER_OF_HOUSE if the user is not member of this house
 * @throws NOT_ADMIN_OF_HOUSE if the user is not admin of this house
 */
export const removeSharedAccount = functions.region('europe-west1').https.onCall((data: RemoveSharedAccountData, context) => {

    const userId: string | undefined = context.auth?.uid;
    if (!userId) {
        throw new functions.https.HttpsError('unauthenticated', ErrorMessage.UNAUTHENTICATED);
    }

    if (!data.houseId || !data.sharedAccountId) {
        throw new functions.https.HttpsError('failed-precondition', ErrorMessage.INVALID_DATA);
    }

    const houseRef = db.collection('houses').doc(data.houseId);

    return db.runTransaction(fireTrans => {
        return fireTrans.get(houseRef)
            .then(houseDoc => {
                const house: House = houseDoc.data() as House;

                // Check if the house exists
                if (!houseDoc.exists || !house) {
                    throw new functions.https.HttpsError('not-found', ErrorMessage.HOUSE_NOT_FOUND);
                }

                // Check if the user is part of this house
                if (!house.members.includes(userId)) {
                    throw new functions.https.HttpsError('permission-denied', ErrorMessage.NOT_MEMBER_OF_HOUSE);
                }

                if (!house.accounts.find(acc => acc.userId === userId)?.roles.includes('ADMIN')) {
                    throw new functions.https.HttpsError('permission-denied', ErrorMessage.NOT_ADMIN_OF_HOUSE);
                }

                const sharedAccount = house.sharedAccounts.find(acc => acc.id === data.sharedAccountId);
                const balance: Balance = house.balances[data.sharedAccountId];

                if (sharedAccount && balance.totalIn === 0 && balance.totalOut === 0) {
                    delete house.balances[data.sharedAccountId];
                    fireTrans.update(houseRef, {
                        sharedAccounts: FieldValue.arrayRemove(sharedAccount),
                        [`balances.${data.sharedAccountId}`]: FieldValue.delete(),
                    });
                } else {
                    console.error('Shared account not found');
                }
            })
            .catch(err => {
                console.error(err);
                throw new functions.https.HttpsError('unknown', ErrorMessage.INTERNAL);
            });
    });
});
