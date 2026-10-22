interface KnownError {
  code?: string;
  message?: string;
  name?: string;
  status?: number;
}

export class ConfigurationError extends Error {
  constructor() {
    super('SUPABASE_NOT_CONFIGURED');
    this.name = 'ConfigurationError';
  }
}

/** Keep technical details in development logs, never interpolate them into the UI. */
export function reportError(context: string, error: unknown): void {
  const details = error as KnownError | null;
  console.error(`[PT Booking] ${context}`, {
    name: details?.name,
    code: details?.code,
    status: details?.status,
    message: details?.message,
  });
}

export function errorMessage(error: unknown): string {
  if (error instanceof ConfigurationError) {
    return 'Il collegamento a Supabase non è ancora configurato. Segui le istruzioni nel README per avviare il progetto.';
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'Sei offline. Controlla la connessione e riprova.';
  }
  const detail = error as KnownError | null;
  const code = detail?.code ?? '';
  const message = detail?.message ?? '';
  if (detail?.name === 'AbortError' || detail?.name === 'TimeoutError' || /request timed out|timeout/i.test(message)) {
    return 'La richiesta sta impiegando troppo tempo. Riprova tra poco.';
  }
  if (['invalid_credentials', 'invalid_grant'].includes(code)) {
    return 'Email o password non corrette.';
  }
  if (code === 'email_not_confirmed') {
    return 'Conferma il tuo indirizzo email usando il messaggio che ti abbiamo inviato.';
  }
  if (['user_already_exists', 'email_exists'].includes(code)) {
    return 'Impossibile completare la registrazione. Se hai già un account, accedi o recupera la password.';
  }
  if (['over_email_send_rate_limit', 'over_request_rate_limit'].includes(code) || detail?.status === 429) {
    return 'Hai effettuato troppi tentativi. Attendi qualche minuto e riprova.';
  }
  if (['session_not_found', 'refresh_token_not_found', 'refresh_token_already_used'].includes(code)
    || detail?.status === 401 || code === 'PGRST301') {
    return 'La sessione è scaduta. Accedi di nuovo.';
  }
  if (/availability_conflict|availability_does_not_overlap/i.test(message)) {
    return 'Questo intervallo si sovrappone a una disponibilità o a una prenotazione esistente. Scegli un altro orario.';
  }
  if (code === '23P01' || /slot_unavailable|slot_taken|booking_conflict|already_booked|SLOT_NOT_AVAILABLE/i.test(message)) {
    return 'Questo orario è stato appena prenotato o non è più disponibile. Seleziona un altro orario.';
  }
  if (/cancellation_deadline|cancellation_not_allowed|too_late_to_cancel|booking_cutoff/i.test(message)) {
    return 'Il termine per cancellare è scaduto. Contatta il tuo trainer.';
  }
  if (/booking_not_cancellable/i.test(message)) {
    return 'Questa prenotazione non può più essere cancellata. Aggiorna l’elenco per verificarne lo stato.';
  }
  if (/not_authorized/i.test(message)) {
    return 'Non hai il permesso per effettuare questa operazione.';
  }
  if (/invalid_input/i.test(message)) {
    return 'Controlla i dati inseriti e gli orari selezionati, poi riprova.';
  }
  if (code === '42501' || detail?.status === 403) {
    return 'Non hai il permesso per effettuare questa operazione.';
  }
  if (code === '23505') {
    return 'Esiste già un elemento con questi dati. Aggiorna la pagina e riprova.';
  }
  if (/Failed to fetch|NetworkError|fetch failed|Load failed/i.test(message)) {
    return 'Non riusciamo a raggiungere il servizio. Controlla la connessione e riprova.';
  }
  return 'Non è stato possibile completare l’operazione. Riprova tra poco.';
}
