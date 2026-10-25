# VocalScribe

Convert English speech from audio or video into text. Transcribe up to 30 seconds per selection and download TXT, SRT, VTT, or JSON.

## First-time setup

1. Install [Node.js LTS](https://nodejs.org/).
2. Download and extract this project.
3. Open the folder containing `package.json` and `package-lock.json`.
4. Open a terminal there. On Windows, click the File Explorer address bar, type `cmd`, and press Enter.
5. Install dependencies:

```bash
npm ci --include=dev
```

Wait until installation finishes successfully. If it reports an error, resolve that error before starting the app.

6. Start the app:

```bash
npm run dev
```

Open the address printed in the terminal, usually **http://localhost:3000**. Keep the terminal open while using the app. Press **Ctrl+C** to stop.

## Next time

Open a terminal in the same project folder and run only:

```bash
npm run dev
```

You do not need to reinstall every time. Install again if you extract the project into a new folder, remove `node_modules`, or update the project's dependencies.

## If Vite is missing

An error mentioning `Cannot find module ... vite/bin/vite.js` means a required installed file is missing. The installation may have failed, been interrupted, or the file may have been removed afterward.

Stop any running app server, then run this in the project folder:

```bash
npm ci --include=dev
```

This replaces `node_modules` using the included lockfile; it does not delete your source code. Once installation succeeds, run `npm run dev`. If installation fails, save the full installation error for troubleshooting. Do not delete `package-lock.json`.

## Use

Choose an audio or video file, select a section if needed, and click **Transcribe**. Review the text, then copy or download it.

No API key is needed. Internet is required for installation and the first speech-model download. Media is processed in your browser. File support and speed depend on your browser and computer. Review transcripts for mistakes. Subtitle timestamps are relative to the selected section.

## Build and share

Run `npm run build` to generate the website in `dist`.

For GitHub, keep this README beside `package.json`. Upload the project files and `src` folder. Do not upload `node_modules` or `dist`. Uploading source to GitHub alone does not publish a live website.

## Support

[Subscribe to The Hack Guy on YouTube](https://www.youtube.com/@HackGuy?sub_confirmation=1).
