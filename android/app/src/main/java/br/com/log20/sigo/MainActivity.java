package br.com.log20.sigo;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

/**
 * Recebe texto compartilhado de outros apps (ex.: a mensagem de fim de turno do WhatsApp, via Compartilhar) e abre a tela
 * "Lançar produção do turno" já com o texto. O texto vai no fragmento da URL (#texto=...), que não é enviado ao servidor.
 */
public class MainActivity extends BridgeActivity {
    private static final String LAUNCH_URL = "https://sigo.log.br/producao/lancar";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleShare(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleShare(intent);
    }

    private void handleShare(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        // Consome o compartilhamento: evita reabrir o mesmo texto se a tela for recriada.
        intent.setAction(Intent.ACTION_MAIN);
        if (text == null || text.trim().isEmpty() || getBridge() == null) return;
        final String url = LAUNCH_URL + "#texto=" + Uri.encode(text);
        final WebView webView = getBridge().getWebView();
        webView.post(new Runnable() {
            @Override
            public void run() {
                webView.loadUrl(url);
            }
        });
    }
}
