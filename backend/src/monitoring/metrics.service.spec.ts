import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  it('após incrementGoogleSync("envio","ok") duas vezes e ("recebimento","erro") uma vez, o texto tem {direction="envio",result="ok"} 2 e {direction="recebimento",result="erro"} 1', () => {
    service.incrementGoogleSync('envio', 'ok');
    service.incrementGoogleSync('envio', 'ok');
    service.incrementGoogleSync('recebimento', 'erro');

    const text = service.toPrometheusText();

    expect(text).toContain(
      'vidaemdia_google_sync_total{direction="envio",result="ok"} 2',
    );
    expect(text).toContain(
      'vidaemdia_google_sync_total{direction="envio",result="erro"} 0',
    );
    expect(text).toContain(
      'vidaemdia_google_sync_total{direction="recebimento",result="ok"} 0',
    );
    expect(text).toContain(
      'vidaemdia_google_sync_total{direction="recebimento",result="erro"} 1',
    );

    const summary = service.getSummary();
    expect(summary.googleEnvioOk).toBe(2);
    expect(summary.googleEnvioErro).toBe(0);
    expect(summary.googleRecebimentoOk).toBe(0);
    expect(summary.googleRecebimentoErro).toBe(1);
  });

  it('sem parâmetro, o texto não contém vidaemdia_google_sync_queue', () => {
    const text = service.toPrometheusText();

    expect(text).not.toContain('vidaemdia_google_sync_queue');
    expect(text).not.toContain('vidaemdia_google_last_pull_timestamp_seconds');
  });

  it('com { queuePending: 3, queueFailed: 1, lastPullAt: new Date("2026-11-15T12:00:00Z") }, contém vidaemdia_google_sync_queue{status="PENDING"} 3, {status="FAILED"} 1 e vidaemdia_google_last_pull_timestamp_seconds 1794744000', () => {
    const text = service.toPrometheusText({
      queuePending: 3,
      queueFailed: 1,
      lastPullAt: new Date('2026-11-15T12:00:00Z'),
    });

    expect(text).toContain('vidaemdia_google_sync_queue{status="PENDING"} 3');
    expect(text).toContain('vidaemdia_google_sync_queue{status="FAILED"} 1');
    expect(text).toContain(
      'vidaemdia_google_last_pull_timestamp_seconds 1794744000',
    );
  });

  it('com lastPullAt: null, o timestamp é 0', () => {
    const text = service.toPrometheusText({
      queuePending: 0,
      queueFailed: 0,
      lastPullAt: null,
    });

    expect(text).toContain('vidaemdia_google_sync_queue{status="PENDING"} 0');
    expect(text).toContain('vidaemdia_google_sync_queue{status="FAILED"} 0');
    expect(text).toContain('vidaemdia_google_last_pull_timestamp_seconds 0');
  });
});
