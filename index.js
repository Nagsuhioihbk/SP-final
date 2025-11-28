// import nodemailer from "nodemailer";

// export default async function handler(req, res) {
//   if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

//   const { fullname, email, phone, subject, description } = req.body;
//   if (!fullname || !email || !phone || !subject || !description) {
//     return res.status(400).json({ message: "All fields are required." });
//   }

//   const transporter = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//       user: process.env.EMAIL_USER,
//       pass: process.env.EMAIL_PASS,
//     },
//   });

//   try {
//     await transporter.sendMail({
//       from: email,
//       to: "nn1528523@gmail.com",
//       subject: `New Contact Form: ${subject}`,
//       text: `
//         Name: ${fullname}
//         Email: ${email}
//         Phone: ${phone}
//         Subject: ${subject}

//         Message:
//         ${description}
//       `,
//     });

//     res.status(200).json({ message: "Message sent successfully" });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Failed to send message", error: err.message });
//   }
// }



/* index.js
   Single entry router for Vercel (@vercel/node) deployments.
   Routes:
     - POST /api/send-email             -> handles contact form (fullname, email, phone, subject, description)
     - POST /api/send-booking-request   -> handles booking form (name, phone, date, pickup, drop, etc.)
     - GET  /api/health or /api/        -> health check
   Place this at project root if your vercel.json routes /api/(.*) -> /index.js
*/
const nodemailer = require("nodemailer");

async function parseJsonBody(req) {
  if (req.body) return req.body;
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        if (!body) return resolve({});
        const parsed = JSON.parse(body);
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", (err) => reject(err));
  });
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function notAllowed(res, allowed = "POST") {
  res.setHeader("Allow", allowed);
  return json(res, 405, { success: false, message: "Method not allowed" });
}

function ensureEmailEnv() {
  const { EMAIL_USER, EMAIL_PASS } = process.env;
  if (!EMAIL_USER || !EMAIL_PASS) {
    const err = new Error("Missing EMAIL_USER or EMAIL_PASS environment variables");
    err.code = "MISSING_EMAIL_ENV";
    throw err;
  }
  return { user: EMAIL_USER, pass: EMAIL_PASS };
}

async function createTransporter() {
  const creds = ensureEmailEnv();
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: creds.user,
      pass: creds.pass,
    },
  });
  // verify to provide early helpful error
  await transporter.verify();
  return transporter;
}

async function handleSendEmail(req, res) {
  if (req.method !== "POST") return notAllowed(res, "POST");

  let body;
  try {
    body = await parseJsonBody(req);
  } catch (err) {
    console.error("Failed to parse JSON body for send-email:", err);
    return json(res, 400, { success: false, message: "Invalid JSON body" });
  }

  const { fullname, email, phone, subject, description } = body || {};
  if (!fullname || !email || !phone || !subject || !description) {
    return json(res, 400, { success: false, message: "All fields are required: fullname, email, phone, subject, description." });
  }

  try {
    const transporter = await createTransporter();
    const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    const toAddress = process.env.EMAIL_RECEIVER || "nn1528523@gmail.com";

    const mailOptions = {
      from: `${fullname} <${fromAddress}>`,
      to: "spglobaltravels@gmail.com",
      subject: `New Contact Form: ${subject}`,
      text: `
Name: ${fullname}
Email: ${email}
Phone: ${phone}
Subject: ${subject}

Message:
${description}
      `,
      html: `
        <p><strong>Name:</strong> ${fullname}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <hr/>
        <p>${String(description).replace(/\n/g, "<br/>")}</p>
      `,
      replyTo: email,
    };

    await transporter.sendMail(mailOptions);
    return json(res, 200, { success: true, message: "Message sent successfully" });
  } catch (err) {
    console.error("send-email error:", err);
    const status = err && err.code === "MISSING_EMAIL_ENV" ? 500 : 500;
    return json(res, status, { success: false, message: "Failed to send message", error: err?.message || String(err) });
  }
}

async function handleSendBookingRequest(req, res) {
  if (req.method !== "POST") return notAllowed(res, "POST");

  let body;
  try {
    body = await parseJsonBody(req);
  } catch (err) {
    console.error("Failed to parse JSON body for send-booking-request:", err);
    return json(res, 400, { success: false, message: "Invalid JSON body" });
  }

  const {
    name,
    phone,
    email = "",
    date,
    time = "",
    pickup,
    drop,
    vehicle = "",
    passengers,
    notes = ""
  } = body || {};

  if (!name || !phone || !date || !pickup || !drop) {
    return json(res, 400, {
      success: false,
      message: "Missing required fields. name, phone, date, pickup and drop are required."
    });
  }

  try {
    const transporter = await createTransporter();
    const bookingId = `BK-${Date.now().toString(36).toUpperCase()}`;
    const recipient = process.env.BOOKING_RECEIVER || process.env.EMAIL_RECEIVER || process.env.EMAIL_USER || "spglobaltravels@gmail.com";

    const subject = `New Booking Request — ${name} — ${bookingId}`;

    const textBody = `
Booking Reference: ${bookingId}

Name: ${name}
Phone: ${phone}
Email: ${email || "—"}
Date: ${date}
Time: ${time || "—"}
Pickup: ${pickup}
Drop: ${drop}
Vehicle: ${vehicle || "—"}
Passengers: ${passengers ?? "—"}

Additional notes:
${notes || "—"}
    `;

    const htmlBody = `
      <h2>New Booking Request</h2>
      <p><strong>Booking Reference:</strong> ${bookingId}</p>
      <table cellpadding="6" cellspacing="0" border="0">
        <tr><td><strong>Name</strong></td><td>${name}</td></tr>
        <tr><td><strong>Phone</strong></td><td>${phone}</td></tr>
        <tr><td><strong>Email</strong></td><td>${email || "—"}</td></tr>
        <tr><td><strong>Date</strong></td><td>${date}</td></tr>
        <tr><td><strong>Time</strong></td><td>${time || "—"}</td></tr>
        <tr><td><strong>Pickup</strong></td><td>${pickup}</td></tr>
        <tr><td><strong>Drop</strong></td><td>${drop}</td></tr>
        <tr><td><strong>Vehicle</strong></td><td>${vehicle || "—"}</td></tr>
        <tr><td><strong>Passengers</strong></td><td>${passengers ?? "—"}</td></tr>
      </table>
      <h4>Additional notes</h4>
      <p>${notes ? String(notes).replace(/\n/g, "<br/>") : "—"}</p>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: recipient,
      subject,
      text: textBody,
      html: htmlBody,
      replyTo: email || undefined,
    });

    return json(res, 200, { success: true, message: "Booking request sent successfully", bookingId });
  } catch (err) {
    console.error("send-booking-request error:", err);
    return json(res, 500, { success: false, message: "Failed to send booking request", error: err?.message || String(err) });
  }
}

async function handler(req, res) {
  try {
    // Normalize path: req.url might be "/api/send-email" or "/send-email" depending on routing
    const host = req.headers && req.headers.host ? `http://${req.headers.host}` : "http://localhost";
    const pathname = new URL(req.url || "/", host).pathname || "/";
    // strip leading /api if present (because Vercel route may forward /api/* -> index.js)
    const path = pathname.startsWith("/api/") ? pathname.slice(5) : pathname.startsWith("/api") ? pathname.slice(4) : pathname;

    // Normalize leading slash
    const normalized = path.startsWith("/") ? path : `/${path}`;

    if (normalized === "/" || normalized === "/health") {
      return json(res, 200, { success: true, message: "ok" });
    }

    if (normalized === "/send-email") {
      return await handleSendEmail(req, res);
    }

    if (normalized === "/send-booking-request") {
      return await handleSendBookingRequest(req, res);
    }

    // Unknown route
    return json(res, 404, { success: false, message: "Not found" });
  } catch (err) {
    console.error("Index router error:", err);
    return json(res, 500, { success: false, message: "Internal server error", error: err?.message || String(err) });
  }
}

module.exports = handler;