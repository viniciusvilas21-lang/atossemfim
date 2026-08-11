export default function PatternDivider() {
  return (
    <div
      aria-hidden="true"
      className="h-3 w-full opacity-40 sm:h-4"
      style={{
        backgroundImage: "url(/assets/padrao-africano.png)",
        backgroundRepeat: "repeat",
        backgroundSize: "56px 56px",
      }}
    />
  );
}
