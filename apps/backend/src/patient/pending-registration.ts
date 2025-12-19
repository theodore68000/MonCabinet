export const pendingPatients = new Map();
/*
Structure :
pendingPatients.set(email, {
  form: { nom, prenom, email, motDePasse... },
  code: "123456",
  expire: Date
})
*/
