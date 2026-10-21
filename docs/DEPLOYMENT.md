# Deployment

## Build

Use Node.js 26.x, npm, Python 3, and Perfect Doc on `PATH`.

```bash
npm ci
npx playwright install chromium
npm run validate
```

Validation runs the fast gate, builds the static site, and runs the Chromium
suite against `dist/`. The build uses an explicit list: `index.html`,
`style.css`, `src/`, and `LICENSE`. Native module paths and the audio worklet
path stay intact. Relative paths support the GitHub Pages repository prefix.
Each build removes the previous output. Do not put authored files in `dist/`.

Run `npm run build` to build alone. Run `npm run preview` to serve the result
at <http://127.0.0.1:7666/>. Rebuild after source changes.

## GitHub Pages

The source repository is [btfranklin/astral-heresy](https://github.com/btfranklin/astral-heresy).
The site address is <https://astral-heresy.btfranklin.info/>.

- Set the Pages source to **GitHub Actions** in repository settings.
- Set the Pages custom domain to `astral-heresy.btfranklin.info`.
- At the DNS provider, set a `CNAME` record named `astral-heresy` to
  `btfranklin.github.io`. The DNS target has no repository path.
- Enable **Enforce HTTPS** after GitHub issues the domain certificate.
- `.github/workflows/validate.yml` validates pushes, pull requests, and manual runs.
- Only a successful run on `main` uploads `dist/` and deploys to `github-pages`.
- The deployment job needs `pages: write` and `id-token: write`. Validation
  needs only read access to repository contents.
- Performance measurements remain separate from the deployment gate.

## Verify And Recover

Check the validation and deployment jobs in GitHub Actions. Confirm that the
deployment uses the intended commit. Open the public site, launch a sortie,
and check graphics and audio startup. Local checks alone do not prove that the
public site works.

If validation fails, correct the reported failure before another deployment.
If deployment fails, check the Pages source setting and environment permissions.
A manual run on `main` repeats validation and deployment. To restore earlier
code, revert the faulty change on `main` and let the same workflow validate it.
