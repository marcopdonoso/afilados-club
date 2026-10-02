import { season } from "@/features/season/model";

export type EntryError = "access" | "oauth" | "logout";
const errors = {
  access: {
    title: "ESA CUENTA NO ESTÁ EN LA LISTA.",
    copy: "Buen intento. Prueba con la cuenta autorizada para el club.",
  },
  oauth: {
    title: "ALGO SE TRABÓ EN LA ENTRADA.",
    copy: "Inténtalo otra vez. Si insiste, culpamos a la tecnología.",
  },
  logout: {
    title: "NO SE PUDO CERRAR LA SESIÓN.",
    copy: "Tu sesión puede seguir abierta. Intenta salir de nuevo.",
  },
};

export function ClubEntry({
  error,
  hasIdentity = false,
}: {
  error?: EntryError;
  hasIdentity?: boolean;
}) {
  const message = error ? errors[error] : null;
  return (
    <div className="season-home entry-page">
      <header className="club-header page-width">
        <p className="club-wordmark">
          AFILADOS <span>CLUB</span>
        </p>
        <p className="technical">{season.name.toUpperCase()}</p>
      </header>
      <main className="entry-main page-width">
        <section className="entry-card" aria-labelledby="entry-heading">
          <p className="technical entry-kicker">SOLO PARA EL GRUPO.</p>
          <h1 id="entry-heading">
            ACCESO
            <br />
            RESTRINGIDO.
          </h1>
          <p className="entry-description">
            Una temporada entre amigos.
            <br />
            Una puerta bastante selectiva.
          </p>
          {message && (
            <div className="entry-error" role="alert">
              <h2 className="technical">{message.title}</h2>
              <p>{message.copy}</p>
            </div>
          )}
          <a className="google-entry" href="/auth/google">
            <span aria-hidden="true">G</span>ENTRAR CON GOOGLE
          </a>
          <p className="entry-note">
            Sin formularios. Sin contraseñas. Sin infiltrados.
          </p>
          {hasIdentity && (
            <form action="/auth/logout" method="post" className="entry-logout">
              <button className="club-logout" type="submit">
                SALIR DE ESTA CUENTA
              </button>
            </form>
          )}
        </section>
      </main>
      <footer className="entry-footer page-width technical">
        AFILADOS CLUB · NO ES UN CALENDARIO. ES UNA TEMPORADA.
      </footer>
    </div>
  );
}
