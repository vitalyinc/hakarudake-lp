/*
 * はかるだけ LP 計測（GA4）
 *
 * GA4_MEASUREMENT_ID が空のあいだは何も読み込まず、何も送らない。
 * 送るイベント（どれも 1 ページ表示につき各 1 回まで。連打は数えない）:
 *   lp_cta_click     問い合わせボタン（Google フォームへのリンク）のクリック
 *                    params: lp_name, cta_position
 *   lp_scroll_depth  25 / 50 / 75 / 90% までのスクロール
 *                    params: lp_name, percent_scrolled
 * 社内の確認アクセスは URL に ?internal=1 を付けて 1 回開くと以後 traffic_type=internal になる
 * （?internal=0 で解除）。GA4 側で「内部トラフィック」フィルタを有効にして除外する。
 * FORM_SOURCE_ENTRY_ID を設定すると、フォームのリンクに流入元（lp / utm / gclid）を事前入力で渡す。
 */
(function () {
  var GA4_MEASUREMENT_ID = '';
  var FORM_SOURCE_ENTRY_ID = ''; // 例: 'entry.123456789'（フォームの「流入元」設問）

  var FORM_URL_PREFIX = 'https://docs.google.com/forms/';
  var SCROLL_MARKS = [25, 50, 75, 90];

  var params = new URLSearchParams(window.location.search);
  var lpName = (window.location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '');

  function isInternal() {
    try {
      if (params.get('internal') === '1') localStorage.setItem('hkd_internal', '1');
      if (params.get('internal') === '0') localStorage.removeItem('hkd_internal');
      return localStorage.getItem('hkd_internal') === '1';
    } catch (e) {
      // プライベートブラウズ等で storage が使えない場合は URL 指定だけで判定する
      return params.get('internal') === '1';
    }
  }

  function sourceLabel() {
    var data = { lp: lpName };
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'gclid'].forEach(function (key) {
      var value = params.get(key);
      if (value) data[key.replace(/^utm_/, '')] = value;
    });
    return Object.entries(data)
      .map(function (entry) { return entry[0] + '=' + entry[1]; })
      .join('|');
  }

  var formLinks = Array.prototype.slice.call(
    document.querySelectorAll('a[href^="' + FORM_URL_PREFIX + '"]')
  );

  if (FORM_SOURCE_ENTRY_ID) {
    formLinks.forEach(function (link) {
      var url = new URL(link.href);
      url.searchParams.set('usp', 'pp_url');
      url.searchParams.set(FORM_SOURCE_ENTRY_ID, sourceLabel());
      link.href = url.toString();
    });
  }

  if (!GA4_MEASUREMENT_ID) return;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  var loader = document.createElement('script');
  loader.async = true;
  loader.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_MEASUREMENT_ID;
  document.head.appendChild(loader);

  gtag('js', new Date());
  var config = { lp_name: lpName };
  if (isInternal()) config.traffic_type = 'internal';
  gtag('config', GA4_MEASUREMENT_ID, config);

  var clickedPositions = {};
  formLinks.forEach(function (link, index) {
    var position = link.getAttribute('data-cta') || 'cta_' + (index + 1);
    link.addEventListener('click', function () {
      if (clickedPositions[position]) return;
      clickedPositions[position] = true;
      gtag('event', 'lp_cta_click', {
        lp_name: lpName,
        cta_position: position,
        transport_type: 'beacon'
      });
    });
  });

  var sentMarks = {};
  function onScroll() {
    var doc = document.documentElement;
    var scrollable = doc.scrollHeight - window.innerHeight;
    var percent = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 100;
    SCROLL_MARKS.forEach(function (mark) {
      if (percent < mark || sentMarks[mark]) return;
      sentMarks[mark] = true;
      gtag('event', 'lp_scroll_depth', { lp_name: lpName, percent_scrolled: mark });
    });
    if (Object.keys(sentMarks).length === SCROLL_MARKS.length) {
      window.removeEventListener('scroll', onScroll);
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
