// import {expect} from 'chai';
// import * as sinon from 'sinon';
// import * as admin from 'firebase-admin';
// import {addTransaction} from '../src';
//
// const test = require('firebase-functions-test')();
//
// describe('Cloud Functions', () => {
//     let adminInitStub;
//     let house: any = {
//         id: 'group1',
//         createdAt: admin.firestore.Timestamp.now(),
//         name: 'Test',
//         currency: 'EUR',
//         inviteLink: '12345678',
//         inviteLinkExpiry: admin.firestore.Timestamp.now(),
//         members: ['user1', 'user2', 'user3'],
//         accounts: [
//             {
//                 createdAt: admin.firestore.Timestamp.now(),
//                 id: 'account1',
//                 name: 'Account 1',
//                 photoUrl: '',
//                 roles: [],
//                 type: 'user',
//                 userId: 'user1',
//             },
//             {
//                 createdAt: admin.firestore.Timestamp.now(),
//                 id: 'account2',
//                 name: 'Account 2',
//                 photoUrl: '',
//                 roles: [],
//                 type: 'user',
//                 userId: 'user2',
//             },
//             {
//                 createdAt: admin.firestore.Timestamp.now(),
//                 id: 'account3',
//                 name: 'Account 3',
//                 photoUrl: '',
//                 roles: [],
//                 type: 'user',
//                 userId: 'user3',
//             },
//         ],
//         sharedAccounts: [],
//         products: [
//             {
//                 createdAt: admin.firestore.Timestamp.now(),
//                 id: 'product1',
//                 name: 'Product1',
//                 price: 50,
//             },
//         ],
//
//         totalIn: 0,
//         totalOut: 0,
//
//         productData: {
//             ['product1']: {
//                 amountIn: 24,
//                 amountOut: 12 + 4 + 6,
//                 totalIn: 1299,
//                 totalOut: 600 + 200 + 300,
//             },
//         },
//
//         balances: {
//             ['account1']: {
//                 products: {
//                     ['product1']: {
//                         amountIn: 24,
//                         amountOut: 12,
//                         totalIn: 1299,
//                         totalOut: 600,
//                     },
//                 },
//                 totalIn: 1299,
//                 totalOut: 600,
//             },
//             ['account2']: {
//                 products: {
//                     ['product1']: {
//                         amountIn: 0,
//                         amountOut: 4,
//                         totalIn: 0,
//                         totalOut: 200,
//                     },
//                 },
//                 totalIn: 0,
//                 totalOut: 200,
//             },
//             ['account3']: {
//                 products: {
//                     ['product1']: {
//                         amountIn: 0,
//                         amountOut: 6,
//                         totalIn: 0,
//                         totalOut: 300,
//                     },
//                 },
//                 totalIn: 0,
//                 totalOut: 300,
//             },
//         },
//     };
//     let user: any = {
//         auth: {
//             uid: 'user1'
//         },
//         authType: 'USER'
//     };
//
//     before(async () => {
//         adminInitStub = sinon.stub(admin, 'initializeApp');
//         test.firestore.makeDocumentSnapshot(group, 'groups/group1');
//     });
//
//     after(() => {
//         // Do cleanup tasks.
//         test.cleanup();
//
//         // Reset the database.
//         // admin.firestore().collection('groups').doc('test').delete();
//     });
//
//     describe('Transactions', () => {
//         describe('#addTransaction', () => {
//             result: any;
//
//             before(() => {
//                 result = await test.wrap(addTransaction)({
//
//                 }, user);
//             });
//
//             it('should create a new transaction in the group', () => {
//
//                 expect(true);
//                 // // Create a DataSnapshot with the value 'input' and the reference path 'messages/11111/original'.
//                 // const snap = test.firestore.makeDataSnapshot('input', 'messages/11111/original');
//                 //
//                 // // Wrap the makeUppercase function
//                 // const wrapped = test.wrap(myFunctions.addTransaction);
//                 // // Call the wrapped function with the snapshot you constructed.
//                 // return wrapped(snap).then(() => {
//                 //     // Read the value of the data at messages/11111/uppercase. Because `admin.initializeApp()` is
//                 //     // called in functions/index.js, there's already a Firebase app initialized. Otherwise, add
//                 //     // `admin.initializeApp()` before this line.
//                 //     return admin.database().ref('messages/11111/uppercase').once('value').then((createdSnap) => {
//                 //         // Assert that the value is the uppercased version of our input.
//                 //         assert.equal(createdSnap.val(), 'INPUT');
//                 //     });
//                 // });
//             });
//         });
//     });
//
// });
