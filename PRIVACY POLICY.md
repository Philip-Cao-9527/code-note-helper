# Privacy Policy

Last updated: March 30, 2026

## 1. Overview

CodeNote Helper is designed to work locally in your browser.

By default, your records, notes, progress data, and settings stay inside your local browser profile on your own computer. The extension does not operate a developer-owned cloud service, does not run analytics, and does not collect personal data for the developer.

## 2. What data may be stored locally

Depending on which features you use, the extension may store the following data in your browser:

- Problem activity records, such as copied prompts, generated notes, saved notes, and timestamps
- Study list data, such as imported list URLs, list items, progress states, and completion statistics
- Local note content that you explicitly save
- API settings that you choose to store locally, such as Base URL, model name, and API key
- Timeline settings, sync settings, and backup metadata
- TorchCode notebook records, including notebook identifiers, titles, source links, and saved notes

## 3. When data may leave your local computer

Your data only leaves your local browser when you explicitly choose one of the following actions:

### A. Direct API note generation

If you configure an LLM API and use direct generation, the prompt you generate is sent directly to the API endpoint that you configured.

The extension does not proxy this data through any developer server.

### B. Nutstore / WebDAV backup

If you manually enable Nutstore backup or restore, the extension sends backup data directly to the WebDAV space that belongs to you.

The developer does not receive a copy of this data.

### C. JSON export / import

If you export a JSON backup, the file is written to a location that you choose through your browser download flow.

## 4. What the developer does not collect

The developer does not collect:

- Your LeetCode notes
- Your TorchCode notebook content
- Your imported study lists
- Your browsing history outside the supported pages
- Your API key through a developer server
- Analytics, tracking identifiers, or advertising profiles

## 5. Permissions and why they are used

The extension requests only the permissions needed for its features:

- `storage`: save settings, notes, progress records, and sync metadata
- `activeTab` / `scripting`: interact with supported pages and read notebook or editor content when you trigger the helper
- `clipboardWrite`: copy prompts and generated notes
- Supported site access: inject the helper on LeetCode, TorchCode, and supported AI chat pages

## 6. Data control

You remain in control of your data.

You can:

- Keep everything local and never enable sync
- Export your local data as JSON
- Import your own backup JSON
- Disable Nutstore backup at any time
- Remove the extension to stop future data processing on supported pages

## 7. Changes to this policy

If this policy changes, the updated version will be published in this repository and shipped with future extension versions.

## 8. Contact

Project repository:

- https://github.com/Philip-Cao-9527/code-note-helper

Issue tracker:

- https://github.com/Philip-Cao-9527/code-note-helper/issues
