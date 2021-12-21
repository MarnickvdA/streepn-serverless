// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
// eslint-disable-next-line import/no-unassigned-import
require('firebase-functions');

// The Firebase Admin SDK to access Firestore.
const { initializeApp } = require('firebase-admin/app');
initializeApp();

// Firestore triggers
export {createUserObject} from './create-user-object.function';

// HTTP Functions
export {acceptTerms} from './accept-terms.function';

export {setProfilePhoto} from './set-profile-photo.function';

export {removeSharedAccount} from './remove-shared-account.function';

export {joinHouse} from './join-house.function';
export {leaveHouse} from './leave-house.function';

export {addStock} from './add-stock.function';
export {editStock} from './edit-stock.function';

export {addTransaction} from './add-transaction.function';
export {editTransaction} from './edit-transaction.function';

export {settleHouse} from './settle-house.function';
export {settleSharedAccount} from './settle-shared-account.function';
export {settleUserAccount} from './settle-user-account.function';

// Messaging functions
