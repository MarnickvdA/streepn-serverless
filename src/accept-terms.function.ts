import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const acceptTerms = functions
    .region('europe-west1')
    .https
    .onCall((data, context) => {
        const userId = context.auth?.uid;
        if (!userId) {
            throw new functions.https.HttpsError('unauthenticated', 'Not authenticated');
        }

        console.log('setting user claims: ' + userId);

        return admin.auth().setCustomUserClaims(userId, {
                acceptedTermsAndPrivacy: true,
                termsAndPrivacyVersion: data.version,
            })
            .then(() => {
                return true;
            })
            .catch((err) => {
                console.error(err);
                return Promise.reject('An error occurred');
            });
    });
