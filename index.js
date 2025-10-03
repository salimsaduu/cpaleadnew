const express = require("express");
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

const app = express();

// Firebase Admin init
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://earn-captcha-bot-latest-default-rtdb.firebaseio.com"
});

const db = admin.database();
const firestore = admin.firestore();

app.get("/postback", async (req, res) => {
  try {
    console.log("👉 Postback received:", req.query);

    const { subid, payout, transactionId } = req.query;

    if (!subid || !payout || !transactionId) {
      return res.status(400).send("❌ Missing subid, payout or transactionId");
    }

    // Coins conversion (1$ = 4000 coins)
    const coins = Math.floor(parseFloat(payout) * 4000);

    // Realtime DB update
    const userRefRT = db.ref(`users/${subid}/coins`);
    const snapshot = await userRefRT.once("value");
    let currentCoinsRT = snapshot.val() || 0;
    await userRefRT.set(currentCoinsRT + coins);

    // Firestore users collection update
    const userRefFS = firestore.collection("users").doc(subid);
    const userDoc = await userRefFS.get();
    let currentCoinsFS = 0;
    if (userDoc.exists) {
      currentCoinsFS = userDoc.data().coins || 0;
    }
    await userRefFS.set(
      { coins: currentCoinsFS + coins },
      { merge: true }
    );

    // Firestore history collection (new entry for each transaction)
    await firestore.collection("history").add({
      subid,
      transactionId,
      payout: parseFloat(payout),
      coins,
      timestamp: new Date().toISOString()
    });

    console.log(`✅ User ${subid} credited with ${coins} coins (payout: $${payout})`);
    return res.status(200).send(`✅ ${coins} coins added to user ${subid}`);
  } catch (err) {
    console.error("❌ Error in postback:", err);
    return res.status(500).send("❌ Server Error: " + err.message);
  }
});

app.get("/", (req, res) => {
  res.send("🚀 CPAlead Postback Server Running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
