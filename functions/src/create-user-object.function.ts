import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Triggers on register of a new user and sets their custom claims to check for terms & privacy.
 * @returns void
 * @throws INTERNAL
 */
export const createUserObject = functions
    .region('europe-west1')
    .auth
    .user().onCreate((user) => {
        return admin.auth().setCustomUserClaims(user.uid, {
            acceptedTermsAndPrivacy: false,
            termsAndPrivacyVersion: '1',
        }).catch((err) => {
            console.error(err);
            throw new functions.https.HttpsError('internal', 'Something went terribly wrong');
        });
    });
