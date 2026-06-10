module.exports = function handler(req, res) {
  res.status(200).json({
    ok: true,
    mp_token: process.env.MP_ACCESS_TOKEN ? '✓ configurado' : '✗ falta MP_ACCESS_TOKEN',
    gh_token: process.env.GH_TOKEN ? '✓ configurado' : '✗ falta GH_TOKEN',
    site_url: process.env.SITE_URL || '(usando default)',
  });
};
