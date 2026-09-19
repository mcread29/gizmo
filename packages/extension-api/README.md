# @gizmo/extension-api

The contract a [Gizmo](https://github.com/mcread29/gizmo) extension is
written against. An extension is a Pi extension that also exports a
`gizmoExtension`; everything it shows in Gizmo is data the host renders, so
an extension never ships browser code and never needs a build step.

```ts
import { defineExtension, type View } from '@gizmo/extension-api';

export const gizmoExtension = defineExtension({
	id: 'hello',
	name: 'Hello',
	views: {
		main: {
			label: 'Hello',
			open(context) {
				context.update({ title: 'Hello', blocks: [{ type: 'text', text: 'Hi' }] });
				return { dispose() {} };
			},
		},
	},
});

export default function hello() {}
```

Gizmo resolves this package to its own copy at runtime, so installing it is
only needed for editor types and tests. Its major version is the extension
API version the host checks.
