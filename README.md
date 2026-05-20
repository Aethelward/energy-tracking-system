<div align="center">
  <h1>⚡ Energy Tracking System</h1>
  <p><strong>A Modern, Web-Based Energy Tracking Application</strong></p>
  <p>
    <img src="https://img.shields.io/badge/SvelteKit-FF3E00?style=for-the-badge&logo=Svelte&logoColor=white" alt="SvelteKit" />
    <img src="https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase" />
    <img src="https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white" alt="Chart.js" />
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  </p>
</div>

---

> **Energy Tracking System** allows you to monitor, visualize, and report energy usage effortlessly with dynamic charts, automated PDF exports, and real-time notifications via Firebase and Resend.

## 🚀 Features

- 📊 **Data Visualization:** Interactive charts powered by Chart.js.
- 🔐 **Authentication:** Secure user login and management via Firebase Auth.
- 📄 **Export & Reporting:** Generate detailed PDF reports using jsPDF and html2pdf.
- 📧 **Notifications:** Automated email delivery using Resend, and SMS support APIs.
- 🔔 **Push Notifications:** Firebase Cloud Messaging (FCM) integration via Service Workers.
- ⚡ **Lightning Fast:** Built on Svelte 5, SvelteKit, and Vite.

## 🛠️ Tech Stack

- **Framework:** [SvelteKit](https://kit.svelte.dev/) with Svelte 5
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Backend/Database:** [Firebase](https://firebase.google.com/) (Auth, Firestore, Messaging)
- **Charting:** [Chart.js](https://www.chartjs.org/)
- **PDF Generation:** [jsPDF](https://github.com/parallax/jsPDF) & [html2pdf.js](https://ekoopmans.github.io/html2pdf.js/)
- **Email:** [Resend](https://resend.com/)

## 💻 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v18+) installed.

### Installation

```bash
git clone <your-repo-url>
cd energy-tracking-system
npm install
```

### Environment Variables

Create a `.env` file in the root directory and add your Firebase and Resend credentials:

```env
PUBLIC_FIREBASE_API_KEY=your_api_key
PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
PUBLIC_FIREBASE_PROJECT_ID=your_project_id
PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
PUBLIC_FIREBASE_APP_ID=your_app_id
PRIVATE_RESEND_API_KEY=your_resend_api_key
```

_(Adjust keys based on your actual `src/lib/firebase.ts` and API routes configuration)_

### Development

Start a local development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

The app will be available at `http://localhost:5173`.

## 🏗️ Building for Production

To create a production version of the application:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## 📜 Scripts

- `npm run check` - Runs TypeScript and Svelte checks.
- `npm run lint` & `npm run format` - Lints and formats code using ESLint and Prettier.

---

<div align="center">
  <em>Built with ❤️ using SvelteKit.</em>
</div>
