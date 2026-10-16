/* About: the Status page's three summary boxes plus a short write-up (template only differs). */
class About extends Status {
  componentDidMount() { super.componentDidMount(); document.title = 'About · VoteFlow'; }
}
VF.page('about', About);
