export default function Footer() {
  return (
    <footer className="text-center py-3 border-top" style={{ borderColor: "var(--wb-border)", color: "var(--wb-text-muted)", fontSize: "0.8125rem" }}>
      WifiBill &copy; {new Date().getFullYear()} — Built by Steve Ongera
    </footer>
  );
}