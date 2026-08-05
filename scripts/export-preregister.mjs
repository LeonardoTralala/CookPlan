import { readFileSync, writeFileSync } from "fs";

const users = [
  { name: "elvira raihan bilqis", email: "porrtgasdrouge@gmail.com", city: "Ponorogo", user_type: "Mahasiswa / Anak Kos" },
  { name: "Fajar Rozaqul Akbar", email: "2006fajar@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
  { name: "tes", email: "kamu@gmail.com", city: "Malang", user_type: "Lainnya" },
  { name: "Ihsan Tasywiq", email: "ihsantasywiq@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
  { name: "Silvi Oktavia Ramadhani", email: "slvoktv@gmail.com", city: "Kabupaten Malang", user_type: "Mahasiswa / Anak Kos" },
  { name: "Muhammad Dimas Sadila", email: "muhammaddimassadila@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
  { name: "Nasya Alifia Rayyani Pambudi", email: "syaalifia1196@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
  { name: "Risma Nur Rofiyanti", email: "rismanurrofiyanti5225@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
  { name: "INDAH SETYA PUTRI", email: "cicisty09@gmail.com", city: "Kota Malang", user_type: "Mahasiswa / Anak Kos" },
  { name: "Irma Ramadia", email: "jiwaypez@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
  { name: "Inggal Ahmad Maulid Putra", email: "inggalahmad@gmail.com", city: "Malang", user_type: "Pekerja" },
  { name: "Nabila Putri", email: "putriramadhan655@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
  { name: "Praysezya Sukma Ristantia", email: "ristantiapraysezya@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
  { name: "Cleonaya Vanya Amelia", email: "cleonayavanya@gmail.com", city: "Kota Malang", user_type: "Mahasiswa / Anak Kos" },
  { name: "Syahlaa Anastasia", email: "syahlaaanastasia@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
  { name: "Ratu Aisyah", email: "rabusedangturu@gmail.com", city: "Kota Malang", user_type: "Mahasiswa / Anak Kos" },
  { name: "IVANA DEWI NUR KOMARIYAH", email: "ivanadewinurkomariyah1108@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
  { name: "Raden Raihan", email: "denrey050412@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
  { name: "MARSYA HENI AURELIA PUTRI", email: "marsyahenia@gmail.com", city: "Kabupaten Malang", user_type: "Mahasiswa / Anak Kos" },
  { name: "afrendi zakki", email: "afrendizakki@icloud.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
  { name: "Azizah", email: "azizahnuruul@gmail.com", city: "Kabupaten malang", user_type: "Lainnya" },
  { name: "Devika Galuh Ecca Primadhanty", email: "devikaeccagaluh2007@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
  { name: "Egista Finalisa", email: "finalsegist42@gmail.com", city: "Kabupaten Malang", user_type: "Lainnya" },
  { name: "Dewi Ika Anggraini", email: "dewiikaanggraini2@gmail.com", city: "Surabaya", user_type: "Mahasiswa / Anak Kos" },
  { name: "Siti Aisyah", email: "siti.aisyah.2407216@students.um.ac.id", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
  { name: "Fannya Prestisia Moriskanadi", email: "fprestisia@student.ub.ac.id", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
  { name: "ELVIN KRESTI PERMATA 1", email: "elvin.permata@mhs.unsoed.ac.id", city: "MALANG (KAB)", user_type: "Mahasiswa / Anak Kos" },
  { name: "Intan Nur Hapsari Wahyudi Putri", email: "intannurhapsari1750@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
  { name: "Tiara Eka", email: "ayuvasha28@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
  { name: "Sindu putri", email: "sinduputri18@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
  { name: "Neta Sari", email: "netaaasarii03@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
  { name: "Narendra Fajar", email: "nareenndrra@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
  { name: "Eka Della Putri Amanda", email: "ekadellaputriamanda@gmail.com", city: "Kabupaten Malang", user_type: "Pekerja" },
  { name: "Dyan Rizki Aditya", email: "rizki@kurakampus.com", city: "Malang", user_type: "Pekerja" }
];

// Export CSV
const csvLines = ["NAME,EMAIL,CITY,USER_TYPE"];
users.forEach(u => csvLines.push(`"${u.name}","${u.email}","${u.city}","${u.user_type || ''}"`));
writeFileSync("preregistrations_export.csv", csvLines.join("\n"), "utf8");

// Export JSON
writeFileSync("preregistrations_export.json", JSON.stringify(users, null, 2), "utf8");

console.log("✅ Berhasil mengekspor 34 data pre-register ke preregistrations_export.csv dan preregistrations_export.json");
