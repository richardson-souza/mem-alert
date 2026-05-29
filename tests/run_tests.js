import { parsePSI, calculateMemoryPercentage, decodeCmd } from '../utils.js';

function assert(condition, message) {
    if (!condition) {
        throw new Error(`[FALHA] ${message}`);
    }
    console.log(`[PASSOU] ${message}`);
}

// --- Suite de Testes ---
try {
    console.log("Iniciando testes de unidade do mem-alert...\n");

    // Teste 1: Parsing de dados PSI normais
    const psiContentMock = "some avg10=12.50 avg60=5.20 avg300=1.10 total=4568\nfull avg10=2.30 avg60=0.80 avg300=0.20 total=1230";
    const psi = parsePSI(psiContentMock);
    assert(psi !== null, "Parsing do PSI não deve retornar nulo");
    assert(psi.some === 12.50, "Deve ler a pressão 'some' corretamente");
    assert(psi.full === 2.30, "Deve ler a pressão 'full' corretamente");

    // Teste 2: Parsing de dados PSI vazios ou corrompidos
    const corruptedPsi = parsePSI("");
    assert(corruptedPsi === null, "Parsing do PSI vazio deve retornar nulo");

    const badPsi = parsePSI("some values without avg\nfull values");
    assert(badPsi === null, "Parsing de dados malformatados deve retornar nulo ou falhar graciosamente");

    // Teste 3: Cálculo de RAM (Total = 16GB, Usada de fato = 4GB)
    const total = 16 * 1024 * 1024 * 1024;
    const free = 4 * 1024 * 1024 * 1024;
    const cached = 6 * 1024 * 1024 * 1024;
    const buffer = 2 * 1024 * 1024 * 1024;
    const pct = calculateMemoryPercentage(total, free, cached, buffer);
    assert(pct === 25, `Cálculo de RAM deve resultar em 25% (obteve: ${pct}%)`);

    // Teste 4: Cálculo de RAM com divisão por zero
    const zeroPct = calculateMemoryPercentage(0, 0, 0, 0);
    assert(zeroPct === 0, "Cálculo de RAM com total zero deve retornar 0");

    // Teste 5: Decodificação de bytes C do GTop em string
    const cmdMock = [103, 110, 111, 109, 101, 45, 115, 104, 101, 108, 108, 0, 0, 0]; // "gnome-shell"
    const decoded = decodeCmd(cmdMock);
    assert(decoded === "gnome-shell", `Deve decodificar o binário do processo em string (obteve: ${decoded})`);

    // Teste 6: Decodificação com array vazio
    const decodedEmpty = decodeCmd([]);
    assert(decodedEmpty === "", "Decodificação de array vazio deve retornar string vazia");

    console.log("\n🎉 Todos os testes passaram com sucesso!");
} catch (error) {
    console.error(`\n❌ Falha nos testes: ${error.message}`);
    // Sair com código de erro se executado em CI/CD
    imports.system.exit(1);
}
