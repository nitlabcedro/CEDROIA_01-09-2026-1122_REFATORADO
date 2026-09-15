import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  avancarMarcadorLeituraParceiro,
  calcularContagemNaoLidasPorParceiro,
  calcularTotalMensagensNaoLidas,
  mensagemIncrementaBadgeGlobal,
  obterIdUltimaMensagemRecebidaDoParceiro,
  somarContagemPorParceiro,
} from "./chat-contagem-nao-lidas";

describe("chat-contagem-nao-lidas", () => {
  const userId = "eu";

  it("lista vazia resulta em zero não lidas", () => {
    assert.equal(calcularTotalMensagensNaoLidas([], userId, {}), 0);
  });

  it("conta todas as recebidas quando não há marcador de leitura", () => {
    const mensagens = [
      { id: "1", sender_id: "a", recipient_id: userId, created_at: "2026-01-01T10:00:00Z" },
      { id: "2", sender_id: "a", recipient_id: userId, created_at: "2026-01-01T11:00:00Z" },
    ];
    assert.equal(calcularTotalMensagensNaoLidas(mensagens, userId, {}), 2);
  });

  it("conta apenas mensagens após o marcador de leitura (ordem decrescente como no Supabase)", () => {
    const mensagens = [
      { id: "3", sender_id: "a", recipient_id: userId, created_at: "2026-01-01T12:00:00Z" },
      { id: "2", sender_id: "a", recipient_id: userId, created_at: "2026-01-01T11:00:00Z" },
      { id: "1", sender_id: "a", recipient_id: userId, created_at: "2026-01-01T10:00:00Z" },
    ];
    const visto = { a: "2" };
    assert.equal(calcularTotalMensagensNaoLidas(mensagens, userId, visto), 1);
  });

  it("ignora mensagens enviadas pelo próprio usuário", () => {
    const mensagens = [
      { id: "1", sender_id: userId, recipient_id: "b", created_at: "2026-01-01T10:00:00Z" },
    ];
    assert.equal(calcularTotalMensagensNaoLidas(mensagens, userId, {}), 0);
  });

  it("mensagemIncrementaBadgeGlobal respeita conversa aberta", () => {
    const msg = { sender_id: "a", recipient_id: userId };
    assert.equal(mensagemIncrementaBadgeGlobal(msg, userId, null, "a"), false);
    assert.equal(mensagemIncrementaBadgeGlobal(msg, userId, null, "b"), true);
  });

  it("somarContagemPorParceiro agrega mapa do Chat", () => {
    assert.equal(somarContagemPorParceiro({ a: 2, b: 1 }), 3);
  });

  it("calcularContagemNaoLidasPorParceiro zera parceiro com conversa aberta", () => {
    const mensagens = [
      { id: "1", sender_id: "a", recipient_id: userId, created_at: "2026-01-01T10:00:00Z" },
      { id: "2", sender_id: "b", recipient_id: userId, created_at: "2026-01-01T10:00:00Z" },
    ];
    const mapa = calcularContagemNaoLidasPorParceiro(mensagens, userId, {}, "a");
    assert.equal(mapa.a, 0);
    assert.equal(mapa.b, 1);
  });

  it("fluxo: abrir conversa marca M1–M3 lidas; M4 nova permanece não lida", () => {
    const feedAntesM4 = [
      { id: "m3", sender_id: "a", recipient_id: userId, created_at: "2026-01-01T12:00:00Z" },
      { id: "m2", sender_id: "a", recipient_id: userId, created_at: "2026-01-01T11:00:00Z" },
      { id: "m1", sender_id: "a", recipient_id: userId, created_at: "2026-01-01T10:00:00Z" },
    ];
    assert.equal(calcularTotalMensagensNaoLidas(feedAntesM4, userId, {}), 3);

    const conversaAberta = [
      { id: "m1", sender_id: "a", recipient_id: userId, created_at: "2026-01-01T10:00:00Z" },
      { id: "m2", sender_id: "a", recipient_id: userId, created_at: "2026-01-01T11:00:00Z" },
      { id: "m3", sender_id: "a", recipient_id: userId, created_at: "2026-01-01T12:00:00Z" },
    ];
    const ultima = obterIdUltimaMensagemRecebidaDoParceiro(conversaAberta, userId, "a");
    assert.equal(ultima, "m3");
    let visto = avancarMarcadorLeituraParceiro({}, userId, "a", ultima, conversaAberta);
    assert.equal(calcularTotalMensagensNaoLidas(feedAntesM4, userId, visto), 0);

    const feedComM4 = [
      { id: "m4", sender_id: "a", recipient_id: userId, created_at: "2026-01-01T13:00:00Z" },
      ...feedAntesM4,
    ];
    assert.equal(calcularTotalMensagensNaoLidas(feedComM4, userId, visto), 1);

    visto = avancarMarcadorLeituraParceiro(visto, userId, "a", "m4", feedComM4);
    assert.equal(calcularTotalMensagensNaoLidas(feedComM4, userId, visto), 0);
  });

  it("enviar nova mensagem (como remetente) não altera marcador de leitura do destinatário", () => {
    const recebidas = [
      { id: "m3", sender_id: "a", recipient_id: userId, created_at: "2026-01-01T12:00:00Z" },
    ];
    const visto = avancarMarcadorLeituraParceiro({}, userId, "a", "m3", recebidas);
    const enviadaPeloUsuario = [
      { id: "out", sender_id: userId, recipient_id: "a", created_at: "2026-01-01T13:00:00Z" },
      ...recebidas,
    ];
    const depois = avancarMarcadorLeituraParceiro(
      visto,
      userId,
      "a",
      obterIdUltimaMensagemRecebidaDoParceiro(enviadaPeloUsuario, userId, "a"),
      enviadaPeloUsuario,
    );
    assert.deepEqual(depois, visto);
  });

  it("marcador de leitura não regride para mensagem mais antiga", () => {
    const ctx = [
      { id: "m3", sender_id: "a", recipient_id: userId, created_at: "2026-01-01T12:00:00Z" },
      { id: "m2", sender_id: "a", recipient_id: userId, created_at: "2026-01-01T11:00:00Z" },
    ];
    let visto = avancarMarcadorLeituraParceiro({}, userId, "a", "m3", ctx);
    visto = avancarMarcadorLeituraParceiro(visto, userId, "a", "m2", ctx);
    assert.equal(visto.a, "m3");
  });

  it("marcador ausente na janela carregada não reabre todas como não lidas", () => {
    const mensagens = [
      { id: "m3", sender_id: "a", recipient_id: userId, created_at: "2026-01-01T12:00:00Z" },
      { id: "m2", sender_id: "a", recipient_id: userId, created_at: "2026-01-01T11:00:00Z" },
    ];
    const visto = { a: "m1" };
    assert.equal(calcularTotalMensagensNaoLidas(mensagens, userId, visto), 0);
  });

  it("badge global reflete soma após leitura parcial", () => {
    const mensagens = [
      { id: "b2", sender_id: "b", recipient_id: userId, created_at: "2026-01-01T12:00:00Z" },
      { id: "a1", sender_id: "a", recipient_id: userId, created_at: "2026-01-01T11:00:00Z" },
    ];
    const porParceiro = calcularContagemNaoLidasPorParceiro(mensagens, userId, { a: "a1" });
    assert.equal(somarContagemPorParceiro(porParceiro), 1);
    assert.equal(porParceiro.b, 1);
    assert.equal(porParceiro.a, 0);
  });
});
