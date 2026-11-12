# plugin-remind

**Reminders** for [FlickerTalk](https://flickertalk.com). Set a reminder on a chat message: a
notification for you alone, kept on this phone.

- A reminder starts **from a message**: hold it, choose *Open with a plugin* → Reminders. The
  plugin gets the message's text and an opaque way back to its conversation.
- Pick when with one tap: **in 1 hour**, **this evening** (19:00, offered while it is more than
  half an hour away) or **tomorrow morning** (09:00), or pick a date and time in Ionic's date
  picker.
- When the notification goes off and you tap it, the plugin opens on that reminder and offers
  **Go to the conversation**. From there you can be reminded again (the same reminder moves) or
  delete it.
- The list shows the reminders still to come first, the soonest first, then the ones that went off,
  the latest first.
- By default the notification only says that you have a reminder; it shows the message's first line
  only if you turn that on in the plugin's settings.

Everything happens on the phone: the plugin has no network, does not see the conversation or who it
is with, and only gets the text **you** hand it with a gesture (`messages: given`). The contact is
not told: a reminder does not touch the protocol or the server.

## What it uses from the core

| Capability    | What for                                                                    |
| ------------- | --------------------------------------------------------------------------- |
| `ft.records`  | one reminder per record (`reminder/<id>`, JSON), within the quota           |
| `ft.remind`   | set, move and cancel the notification (`remind` permission); same id as the record |
| `ft.store`    | the "message text in the notification" setting                              |
| `ft.openChat` | back to the conversation the message came from (`ref`)                      |
| `ft.notify`   | a short notice saying when the reminder will go off, if the app has it      |
| `onOpen`      | `text` + `ref` from a message; `reminder` when the notification is tapped; `lang` |

It needs core **1.6.0** (`minCoreVersion`). The contract is in
[plugin-sdk](https://github.com/FlickerTalk/plugin-sdk).

The window is drawn with the Ionic the app lends to the frame: the bar in `ion-header > ion-toolbar`,
the body in `ion-content`, the list in `ion-list`, the moments as `ion-button`s, the picker as
`ion-datetime`, the setting as `ion-toggle`, and deleting asks with `ion-alert` (`confirm()` does
nothing in the frame). No close button of its own: the app's window has one. The package carries no
Ionic: `@ionic/core` is only a `devDependency`, so the tests draw what the phone draws.

## Development

```sh
npm install
npm test
```

`dist/index.js` registers the web component `ft-remind`; `dist/i18n.js` holds the texts in the 21
languages of the app (a test checks that every language has the same keys as English). There is
nothing to build. The `.ftplugin` package is signed by the FlickerTalk catalogue; it is not built
here.

## Licence

MIT.
