export default function PatternDivider() {
  return (
    <div
      aria-hidden="true"
      className="h-8 w-full sm:h-10"
      style={{
        backgroundImage: "url(/assets/padrao-africano.png)",
        backgroundRepeat: "repeat",
        backgroundSize: "64px 64px",
      }}
    />
  );
}
