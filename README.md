# Shipment ETA Tracking

A responsive GitHub Pages website where customers can look up a shipment by Bill of Lading (BL) number. An authenticated admin page manages the tracking records in Firebase Firestore.

## Pages

- `index.html` — public tracking. Customers only see the BL search and shipment result.
- `admin.html` — private admin sign-in and shipment add/edit/delete tools. Do not link this page from the public interface.

## Firebase setup

### 1. Create the Firebase project

1. In [Firebase Console](https://console.firebase.google.com/), create or select a project.
2. Add a **Web app** and copy its Firebase configuration.
3. Replace the placeholder values in `firebase-config.js`. A Firebase web config is an identifier, not a secret; access control comes from Authentication and Firestore Rules.

### 2. Enable Authentication

1. Open **Authentication → Sign-in method**.
2. Enable **Email/Password**.
3. Open **Authentication → Users** and create the admin account. There is intentionally no public sign-up screen.

### 3. Grant the admin claim

The admin UI and Firestore Rules require the custom claim `admin: true`. Set it once from a trusted environment with the Firebase Admin SDK (never from browser code):

```js
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.applicationDefault() });

admin.auth().getUserByEmail("admin@company.com")
  .then((user) => admin.auth().setCustomUserClaims(user.uid, { admin: true }))
  .then(() => console.log("Admin claim assigned"));
```

After assigning the claim, sign out and sign in again so Firebase issues a new ID token.

### 4. Create Firestore and deploy the rules

1. Create a Firestore database in **Production mode**.
2. Copy the contents of `firestore.rules` into **Firestore Database → Rules**, then publish it.

The rules allow public reads only for `shipments`. Creating, updating, and deleting require a signed-in user whose token contains `admin: true`. All other Firestore paths are denied.

### 5. Authorized domains

In **Authentication → Settings → Authorized domains**, add:

```text
harry-nguyen-96.github.io
```

`localhost` can remain enabled for local testing.

## Data model

Records are stored in the `shipments` collection. The normalized uppercase BL number is also the document ID.

```text
shipments/{BL_NUMBER}
  blNumber: "ONEYSGN123456"
  vesselName: "ONE INTEGRITY"
  voyageNumber: "0123W"
  eta: "2026-09-21"
  updatedAt: server timestamp
  updatedBy: Firebase Auth UID
```

## Local test

Because Firebase scripts are loaded from a CDN, serve the folder through a local web server rather than opening the HTML file directly. For example:

```powershell
python -m http.server 8080
```

Then visit:

- Public: `http://localhost:8080/`
- Admin: `http://localhost:8080/admin.html`

With placeholder Firebase values, both pages intentionally show a friendly configuration message rather than making a broken request.

## GitHub Pages deployment

In the GitHub repository, open **Settings → Pages**, choose **Deploy from a branch**, then select the `main` branch and `/ (root)`. The public URL remains:

```text
https://harry-nguyen-96.github.io/BL-ETA/
```

The admin URL is:

```text
https://harry-nguyen-96.github.io/BL-ETA/admin.html
```

## Security notes

- No admin password is stored in the repository or browser JavaScript.
- Hiding the admin URL is not a security boundary; Firebase Authentication and Firestore Rules enforce access.
- Keep account passwords and Firebase service-account keys out of this repository.
- Revoke the admin claim or disable the Firebase Auth user immediately if access should be removed.
