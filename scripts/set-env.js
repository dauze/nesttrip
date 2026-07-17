const fs = require('fs');

const targetPath = './src/environments/environment.prod.ts';

const envConfigFile = `export const environment = {
  production: true,
  apiKey: '${process.env.apiKey}',
  googleMapsApiKey: '${process.env.googleMapsApiKey}',
  googleMapsMapId: '${process.env.googleMapsMapId}',
  firebase: {
    apiKey: "${process.env.apiKey}",
    authDomain: "${process.env.authDomain}",
    projectId: "${process.env.projectId}",
    storageBucket: "${process.env.storageBucket}",
    messagingSenderId: "${process.env.messagingSenderId}",
    appId: "${process.env.appId}",
    measurementId: "${process.env.measurementId}",
  }
};
`;

fs.writeFileSync(targetPath, envConfigFile);
console.log(`Fichier ${targetPath} généré avec succès`);