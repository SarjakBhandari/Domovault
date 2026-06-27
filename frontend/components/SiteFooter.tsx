export default function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6 lg:px-8">
        <p>&copy; {new Date().getFullYear()} Domovault. All rights reserved.</p>
        <nav aria-label="Footer">
          <ul className="flex gap-6">
            <li>
              <a href="#" className="rounded-md hover:text-brand-700">
                About
              </a>
            </li>
            <li>
              <a href="#" className="rounded-md hover:text-brand-700">
                Help / FAQ
              </a>
            </li>
            <li>
              <a href="#" className="rounded-md hover:text-brand-700">
                Privacy
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
