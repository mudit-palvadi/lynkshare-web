# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React owns the screens. Crypto, framing, signaling, and WebRTC stay plain modules the screens call. Two documents: a marketing page, and a transfer app whose script realm never loads an ad. Confirmed for the website revamp on 2026-11-17. The Android app stays Flutter and must keep reading the current link format.

## Users

Everyday people sending a file to someone nearby or on another network, with no account. A privacy-conscious person sending a document they do not want stored in the clear. iOS users have no app and receive in the browser. The Android app is the other client, not a separate product.

## Product Purpose

Move a file from one device to another with no registration. The file is encrypted on the sender's device. The key travels in the link fragment, not to the server. Success is the receiver saving the same bytes, on the web or in the Android app, without an account.

## Positioning

The server stores ciphertext and session metadata. It never receives the file key. A share link is the capability. A six-digit code names a session and is not itself the key. The sender seals the key to the receiver's ephemeral public key.

## Operating Context

The live site is `https://lynkshare.app`. The API is `https://api.lynkshare.app`. Existing links are `https://lynkshare.app/send/{id}#{key}` and, when an access token is present, `#{key}&a={token}`. Pairing links are `https://lynkshare.app/receive/{sessionId}#pk={publicKey}`. Cloud sessions last 10 minutes and can be extended to 30. Direct transfer uses WebRTC, then the encrypted cloud copy. The website limit is 10 MB total per transfer. The app allows more. There is no web unlock.

## Capabilities and Constraints

The website sends and receives. It does not create accounts, and it does not claim an iOS app.

New links will use AES-GCM with a 32-byte key. The website and the app keep reading today's AES-CBC links until those sessions expire. The app must understand the new format before the website starts writing it. After that, a peer that does not advertise the new format still receives the current format for that session. Confirmed 2026-11-17.

Ads stay. They render in a cross-origin frame that cannot read the page's key. Confirmed 2026-11-17.

The key stays in memory for that page. A reload needs the original link. History stores names and sizes for the tab session and never the key, the link, or the access token.

Receiver signaling rooms stay id-only while the QR path is the secret. That exception is not reused for transfer rooms.

Hiding local addresses from the peer requires a relay-only policy that is not approved. Direct connections stay.

## Brand Commitments

The name is LynkShare. The voice is direct and concrete. Privacy claims match the implementation: client-side encryption, no account, the server does not see the file key. Each visit to the website home asks the person to download the Android app and states the real differences: higher size limits and fewer ads. Continuing on the web is always available. The app is not an apology for the website. Confirmed 2026-11-17.

## Evidence on Hand

Product numbers live in `docs/PRD.md` in the parent tree. Current behavior lives in `docs/Memory.md`. Open risks live in `docs/POTENTIAL_ISSUES.md`. The revamp plan is `docs/website-revamp.md`. A two-desktop cloud transfer on 2026-11-17 uploaded `lynk-desktop-check.txt` and decrypted the same sentence on the other desktop. That run also showed a file dialog that closed on Enter while a folder was highlighted, and a first load that lost the URL fragment while still showing the file name.

Do not invent testimonials, download counts, or an iOS app.

## Product Principles

The receiver's job is to get the file, including on a phone browser with no app installed.

A control that names a secret must not fire until a person confirms it.

Metadata without the key is not a finished download.

Third-party script does not share a realm with the file key.

Old links keep working until they expire.

## Accessibility & Inclusion

The code field has a visible label. Status and progress are announced. Focus is visible. The transfer screens work at phone width and with large text. Reduced motion keeps the state changes and drops the decoration.
