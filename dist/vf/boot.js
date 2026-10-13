(function () {
  const r = VF.route(location.pathname);
  VF.mount(r.page, r.props, document.getElementById('app'));
})();
