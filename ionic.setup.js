import { alertController, initialize } from "@ionic/core/components";
import { defineCustomElement as alert } from "@ionic/core/components/ion-alert.js";
import { defineCustomElement as button } from "@ionic/core/components/ion-button.js";
import { defineCustomElement as buttons } from "@ionic/core/components/ion-buttons.js";
import { defineCustomElement as content } from "@ionic/core/components/ion-content.js";
import { defineCustomElement as datetime } from "@ionic/core/components/ion-datetime.js";
import { defineCustomElement as header } from "@ionic/core/components/ion-header.js";
import { defineCustomElement as icon } from "@ionic/core/components/ion-icon.js";
import { defineCustomElement as item } from "@ionic/core/components/ion-item.js";
import { defineCustomElement as label } from "@ionic/core/components/ion-label.js";
import { defineCustomElement as list } from "@ionic/core/components/ion-list.js";
import { defineCustomElement as note } from "@ionic/core/components/ion-note.js";
import { defineCustomElement as toggle } from "@ionic/core/components/ion-toggle.js";
import { defineCustomElement as toolbar } from "@ionic/core/components/ion-toolbar.js";

initialize();
for (const define of [alert, button, buttons, content, datetime, header, icon, item, label, list, note, toggle, toolbar]) define();
globalThis.ftIonic = { alertController };
