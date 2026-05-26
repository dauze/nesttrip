// scripts/seed-firestore.ts
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, } from 'firebase/firestore';
const app = initializeApp({
  apiKey: "AIzaSyBkknHakNu9wgl8peo5lC5Xf_D7Aqy8t34",
  authDomain: "nesttrip-2e34b.firebaseapp.com",
  projectId: "nesttrip-2e34b",
  storageBucket: "nesttrip-2e34b.firebasestorage.app",
  messagingSenderId: "717386228762",
  appId: "1:717386228762:web:28ef39cf442510b9eb1da3",
  measurementId: "G-ZHQJ9E5ZK0"
});
const db = getFirestore(app);

/**
 * Données de voyage – compléter les jours manquants.
 * Structure identique à l'original data-days.js.
 */
const TRIP_DATA = [{
  "id": 1,
  "title": "Week-end à Tokyo",
  "days": {
    "1747296000000": {
      "activities": [
        {
          "id": 101,
          "title": "Vol Paris → Tokyo",
          "type": "TRANSPORT",
          "duration": 840,
          "price": { "amount": 850, "currency": "EUR" },
          "placeId": "cdg-airport",
          "booking": {
            "status": "BOOKED",
            "deadline": "2026-04-01T00:00:00.000Z"
          },
          "notes": "Arriver 3h avant le départ",
          "website": "https://www.airfrance.fr",
          "phone": "+33123456789",
          "files": [
            { "url": "https://example.com/boarding-pass.pdf", "name": "boarding-pass.pdf", "path": "/documents/boarding-pass.pdf" },
            { "url": "https://example.com/e-ticket.pdf", "name": "e-ticket.pdf", "path": "/documents/e-ticket.pdf" }
          ]
        },
        {
          "id": 102,
          "title": "Check-in hôtel Shinjuku",
          "type": "HEBERGEMENT",
          "duration": 60,
          "price": { "amount": 320, "currency": "EUR" },
          "placeId": "hotel-shinjuku",
          "booking": {
            "status": "TO_BOOK",
            "deadline": "2026-05-10T12:00:00.000Z"
          },
          "notes": "Demander une chambre avec vue",
          "website": "https://example-hotel.com",
          "phone": "+81312345678",
          "files": [
            { "url": "https://example.com/reservation.pdf", "name": "reservation.pdf", "path": "/documents/reservation.pdf" }
          ]
        }
      ]
    },
    "1747382400000": {
      "activities": [
        {
          "id": 103,
          "title": "Visite du temple Sensō-ji",
          "type": "VISITE",
          "duration": 120,
          "price": { "amount": 0, "currency": "JPY" },
          "placeId": "sensoji-temple",
          "notes": "Y aller tôt pour éviter la foule",
          "website": "https://www.senso-ji.jp"
        },
        {
          "id": 104,
          "title": "Restaurant sushi",
          "type": "REPAS",
          "duration": 90,
          "price": { "amount": 45, "currency": "EUR" },
          "placeId": "sushi-restaurant",
          "booking": { "status": "CONFIRMED" },
          "notes": "Réservation pour 2 personnes",
          "phone": "+81387654321"
        },
        {
          "id": 105,
          "title": "Shopping à Akihabara",
          "type": "SHOPPING",
          "duration": 180,
          "price": { "amount": 150, "currency": "EUR" },
          "placeId": "akihabara",
          "notes": "Acheter des figurines et gadgets"
        }
      ]
    }
  },
  "info": {
    "id": 500,
    "items": [
      {
        "id": 1,
        "title": "Documents importants",
        "type": "DOCUMENT",
        "elements": [
          { "text": "Passeport valide", "checked": true },
          { "text": "Billets d'avion imprimés", "checked": false },
          { "text": "Assurance voyage", "checked": true }
        ]
      },
      {
        "id": 2,
        "title": "Checklist bagages",
        "type": "CHECKLIST",
        "elements": [
          { "text": "Chargeur téléphone", "checked": true },
          { "text": "Adaptateur prise Japon", "checked": false },
          { "text": "Vêtements légers", "checked": true }
        ]
      },
      {
        "id": 3,
        "title": "Infos utiles",
        "type": "INFO",
        "elements": [
          { "text": "Wi-Fi portable réservé", "checked": false },
          { "text": "Carte Suica à acheter", "checked": false }
        ]
      }
    ]
  }
}];

async function seed() {
  console.log('Début import...');
  for (const trip of TRIP_DATA) {
    await setDoc(doc(db, 'trips', String(trip.id)), trip);
    console.log(`✓ Trip "${trip.title}" (id: ${trip.id}) importé`);
  }
  console.log('Import terminé.');
}

seed().catch(console.error);