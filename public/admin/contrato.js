"use strict";
// Contrato da Maja Kids (texto do modelo que ela usa), preenchido com os dados da reserva.
// A folha é editável: dá para clicar e corrigir qualquer texto antes de salvar o PDF.
(async () => {
  const { api, reais, dataBR, esc } = Painel;
  const id = Number(Painel.param("id"));
  const folha = document.getElementById("folha");
  const linha = (v, tam = 40) => v ? esc(v) : "_".repeat(tam);
  try {
    const [r, b] = await Promise.all([api("reservas/uma?id=" + id).then(x => x.reserva), api("brinquedos").then(x => x.brinquedos)]);
    const nome = bid => (b.find(x => x.id === bid) || {}).nome || bid;
    document.title = `Contrato ${r.cliente_nome} ${dataBR(r.data).replace(/\//g, "-")} · Maja Kids`;
    const nomes = r.itens.map(i => nome(i.brinquedo));
    const lista = nomes.length > 1 ? nomes.slice(0, -1).join(", ") + " e " + nomes.at(-1) : nomes[0] || "";
    const locacao = r.itens.reduce((s, i) => s + i.valor, 0);
    const p = t => `<p>${t}</p>`;
    const sec = (n, titulo, ...pars) => `<h2>${n}. ${titulo}</h2>${pars.map(p).join("")}`;
    const caixa = t => `<li>☐ ${t}</li>`;
    const hojeBR = new Date().toLocaleDateString("pt-BR");

    folha.innerHTML = `
      <h1>CONTRATO DE LOCAÇÃO DE BRINQUEDOS E SERVIÇOS PARA EVENTOS</h1>
      <p class="sub"><b>MAJA KIDS</b></p>
      ${p("Pelo presente instrumento particular, de um lado:")}
      ${p("<b>MAJA KIDS</b>, inscrita no CNPJ sob nº <b>68.861.909/0001-78</b>, neste ato representada por <b>Maria Júlia Pinho Magalhães</b>, doravante denominada <b>LOCADORA</b>;")}
      ${p("E, de outro lado:")}
      <p class="dados"><b>CONTRATANTE:</b> ${linha(r.cliente_nome)}<br><b>CPF/CNPJ:</b> ${linha(r.documento)}<br><b>Telefone:</b> ${linha(r.telefone)}<br><b>E-mail:</b> ${linha(r.email)}<br><b>Endereço:</b> ${linha(r.endereco_residencial)}</p>
      ${p("têm entre si justo e contratado o presente <b>Contrato de Locação de Brinquedos e/ou Prestação de Serviços para Eventos</b>, mediante as cláusulas e condições seguintes.")}
      <h2>1. OBJETO DO CONTRATO</h2>
      ${p("O presente contrato tem por objeto a locação dos brinquedos e/ou contratação dos serviços especificados abaixo, para utilização durante o evento do CONTRATANTE:")}
      <p class="dados"><b>Evento:</b> ${"_".repeat(40)}<br><b>Data:</b> ${dataBR(r.data)}<br><b>Horário de início:</b> ${linha(r.hora_inicio, 10)} &nbsp; <b>Horário de término:</b> ${linha(r.hora_fim, 10)}<br>
        <b>Local do evento:</b> ${linha(r.endereco_montagem)}<br><b>Brinquedo(s)/serviço(s) contratado(s):</b> ${linha(lista, 60)}</p>
      <p class="dados"><b>Valor da locação/serviço:</b> ${reais(locacao)}<br><b>Taxa de entrega/montagem, quando aplicável:</b> ${reais(r.taxa_entrega)}<br><b>Valor total:</b> ${reais(r.total)}</p>
      ${sec(2, "RESERVA DA DATA E FORMA DE PAGAMENTO",
        "Para confirmação da reserva da data, o CONTRATANTE deverá efetuar o pagamento de <b>50% (cinquenta por cento) do valor total contratado</b>, denominado neste contrato <b>valor de reserva/sinal</b>.",
        "O pagamento dos 50% será considerado condição para confirmação da reserva da data, ficando a contratação sujeita à confirmação do pagamento pela MAJA KIDS.",
        "Os <b>50% (cinquenta por cento) restantes</b> deverão ser pagos pelo CONTRATANTE até <b>1 (um) dia antes</b> da realização do evento.",
        "Caso o saldo restante não seja pago dentro do prazo estabelecido, a MAJA KIDS poderá deixar de realizar a entrega, montagem ou prestação do serviço contratado, observadas as disposições de cancelamento deste contrato e os direitos previstos na legislação aplicável.",
        "O pagamento realizado para reserva da data não será considerado caução ou depósito de garantia, mas sim parte do preço contratado destinada à reserva da data e à confirmação da contratação.")}
      ${sec(3, "ENTREGA, MONTAGEM E LOCAL DO EVENTO",
        "Quando contratado, a MAJA KIDS será responsável pela entrega, montagem e desmontagem dos brinquedos no local indicado pelo CONTRATANTE.",
        "O CONTRATANTE deverá disponibilizar espaço adequado, seguro, acessível e compatível com o brinquedo contratado, observando as dimensões e condições previamente informadas pela MAJA KIDS.",
        "O CONTRATANTE deverá informar previamente qualquer dificuldade de acesso ao local, escadas, portões, corredores estreitos, desníveis, obstáculos ou outras condições que possam interferir na entrega, montagem ou retirada dos equipamentos.",
        "Caso o local apresente condições que possam comprometer a segurança dos usuários, dos equipamentos ou da equipe da MAJA KIDS, a instalação poderá ser recusada ou interrompida até que sejam providenciadas condições adequadas.",
        "Quando o equipamento necessitar de energia elétrica, o CONTRATANTE deverá disponibilizar ponto de energia adequado e em condições de utilização.",
        "Quando o brinquedo necessitar de água, o CONTRATANTE deverá disponibilizar uma fonte de água e uma mangueira com acesso próximo ao local de instalação.")}
      ${sec(4, "USO DOS BRINQUEDOS, SUPERVISÃO E REGRAS DE SEGURANÇA",
        "O CONTRATANTE declara que recebeu e está ciente das orientações de uso e segurança fornecidas pela MAJA KIDS, comprometendo-se a cumpri-las e a orientar todos os usuários, responsáveis e convidados presentes no evento.",
        "Os brinquedos deverão ser utilizados exclusivamente para a finalidade a que se destinam, respeitando-se os limites de idade, peso, capacidade, quantidade de usuários e demais especificações informadas pela MAJA KIDS.",
        "É proibida a entrada nos brinquedos com objetos que possam causar danos, incluindo, mas não se limitando a, objetos cortantes ou perfurantes, tesouras, facas, chaves, brinquedos rígidos, calçados inadequados e outros objetos que possam comprometer a integridade do equipamento.",
        "Também não será permitida a utilização dos brinquedos de forma inadequada, perigosa ou em desacordo com as orientações da MAJA KIDS, bem como a entrada de animais, alimentos ou bebidas, salvo quando expressamente autorizado.",
        "A supervisão das crianças e demais usuários durante a utilização dos brinquedos será de responsabilidade do CONTRATANTE e dos responsáveis legais pelos menores, que deverão acompanhar e orientar as crianças quanto ao cumprimento das regras de segurança, salvo quando a própria MAJA KIDS tiver contratado e disponibilizado monitor para aquela atividade específica.",
        "A presença de monitor da MAJA KIDS, quando contratada, tem como finalidade auxiliar na organização e no cumprimento das regras de utilização do brinquedo e não substitui a responsabilidade dos pais, responsáveis legais ou do CONTRATANTE pela guarda, acompanhamento e supervisão geral das crianças.",
        "O CONTRATANTE deverá comunicar imediatamente à MAJA KIDS qualquer situação de risco, comportamento inadequado, acidente, lesão ou problema identificado durante a utilização dos brinquedos.",
        "O CONTRATANTE e os responsáveis pelos usuários deverão impedir a utilização do brinquedo por crianças ou pessoas que não estejam dentro dos limites de idade, peso, capacidade ou condições de segurança estabelecidos para o equipamento.",
        "O CONTRATANTE não poderá mover, desmontar, alterar, modificar ou tentar reparar qualquer brinquedo após sua instalação, sem autorização expressa da MAJA KIDS.",
        "Caso ocorra acidente ou lesão em decorrência de descumprimento das regras de segurança, utilização inadequada do equipamento, desobediência às orientações fornecidas, utilização por pessoa fora dos limites estabelecidos ou ausência/insuficiência de supervisão que seja de responsabilidade do CONTRATANTE ou dos responsáveis pelos usuários, serão observadas as responsabilidades legais aplicáveis ao caso.",
        "A MAJA KIDS não assume a guarda ou responsabilidade geral pelas crianças presentes no evento, cabendo aos pais, responsáveis legais e ao CONTRATANTE zelar pela integridade e supervisão dos menores, sem prejuízo das responsabilidades que legalmente possam ser atribuídas à MAJA KIDS por falha na prestação de seus próprios serviços, defeito do equipamento ou atuação de seus funcionários/prepostos.",
        "Em caso de dano ao brinquedo decorrente de uso inadequado, negligência, descumprimento das regras de segurança ou utilização em desacordo com as orientações fornecidas pela MAJA KIDS, o CONTRATANTE será responsável pela reparação dos prejuízos comprovadamente causados.",
        "Quando o dano comprometer a segurança, funcionalidade, integridade, aparência, durabilidade ou condição adequada do brinquedo para novas locações, a MAJA KIDS poderá exigir o valor necessário para sua substituição por equipamento equivalente, quando a substituição for necessária, e não apenas o custo de eventual remendo ou reparo.",
        "O fato de o brinquedo poder receber um reparo não obrigará a MAJA KIDS a aceitar o equipamento reparado para novas locações quando o dano comprometer sua segurança, integridade, qualidade, aparência, durabilidade ou condição adequada de uso.",
        "Caso o dano seja reparável e não comprometa os aspectos mencionados acima, poderão ser cobrados os custos razoáveis e comprovados de reparação. Caso o equipamento seja considerado irrecuperável ou sua substituição seja necessária, poderá ser cobrado o prejuízo correspondente à substituição por equipamento equivalente, observados os limites e direitos previstos na legislação aplicável.",
        "A MAJA KIDS poderá registrar, por meio de fotografias, vídeos, vistoria e outros meios de prova, as condições dos brinquedos antes, durante e após a locação, para fins de comprovação do estado do equipamento e de eventuais danos ou ocorrências.")}
      ${sec(5, "SUPERVISÃO E MONITORIA",
        "Quando houver contratação de monitor, sua função será auxiliar na organização, orientação e segurança operacional do brinquedo durante o período contratado.",
        "A monitoria não substitui a responsabilidade dos pais ou responsáveis legais pela supervisão geral das crianças.",
        "Os pais ou responsáveis deverão permanecer atentos às crianças, especialmente em situações que envolvam necessidades específicas, limitações físicas, condições particulares ou comportamentos que possam representar risco.")}
      ${sec(6, "ENTREGA, VISTORIA E DEVOLUÇÃO",
        "A MAJA KIDS poderá realizar registro fotográfico e/ou audiovisual do equipamento antes da instalação, durante sua utilização e após a desmontagem.",
        "O CONTRATANTE poderá acompanhar a vistoria realizada no momento da entrega e deverá comunicar imediatamente qualquer problema aparente identificado no equipamento.",
        "Ao término da locação, será realizada vistoria para verificar as condições dos equipamentos.",
        "Danos decorrentes do uso normal e adequado do equipamento não serão considerados responsabilidade do CONTRATANTE.",
        "Danos decorrentes de mau uso, negligência, descumprimento das regras de segurança ou utilização inadequada serão tratados conforme a Cláusula 4 deste contrato.")}
      ${sec(7, "ATRASOS",
        "O atraso causado pelo CONTRATANTE ou pelos convidados do evento não implicará, automaticamente, extensão do período de locação.",
        "Eventual extensão do período poderá ser solicitada, mas dependerá da disponibilidade da MAJA KIDS e poderá gerar cobrança adicional.",
        "Caso eventual atraso seja causado pela MAJA KIDS, a empresa buscará, quando operacionalmente possível, compensar o período afetado ou apresentar solução adequada ao caso.")}
      ${sec(8, "CANCELAMENTO",
        "O CONTRATANTE poderá solicitar o cancelamento da contratação, observados os prazos e condições abaixo, sem prejuízo dos direitos previstos na legislação aplicável.",
        "<b>Cancelamento com 7 (sete) dias ou mais de antecedência:</b> será devolvido o valor pago pelo CONTRATANTE, observados os direitos legais eventualmente aplicáveis.",
        "<b>Cancelamento entre 6 (seis) e 4 (quatro) dias antes do evento:</b> a MAJA KIDS poderá reter o equivalente a 25% do valor total da contratação, devolvendo eventual valor pago que ultrapasse esse montante.",
        "<b>Cancelamento entre 3 (três) e 2 (dois) dias antes do evento:</b> a MAJA KIDS poderá reter o equivalente a 50% do valor total da contratação, devolvendo eventual valor pago que ultrapasse esse montante.",
        "<b>Cancelamento com 1 (um) dia de antecedência ou no próprio dia do evento:</b> a MAJA KIDS poderá reter o equivalente a 50% do valor total da contratação, devolvendo eventual valor pago que ultrapasse esse montante.",
        "As regras acima não afastam eventual direito legal de arrependimento ou qualquer outro direito assegurado ao consumidor pela legislação aplicável.")}
      ${sec(9, "REAGENDAMENTO",
        "Solicitações de reagendamento realizadas com 7 (sete) dias ou mais de antecedência poderão ser realizadas uma única vez, sem cobrança de multa, desde que exista disponibilidade na agenda da MAJA KIDS.",
        "A nova data estará condicionada à disponibilidade da empresa e não poderá prejudicar reservas previamente confirmadas.",
        "Caso a nova data possua valor de contratação superior, o CONTRATANTE deverá pagar a diferença correspondente.",
        "Caso a nova data possua valor inferior, eventual diferença será ajustada de forma transparente entre as partes.",
        "Solicitações realizadas com menos de 7 (sete) dias de antecedência poderão ser analisadas pela MAJA KIDS, conforme disponibilidade e condições operacionais, podendo ser aplicadas as regras de cancelamento correspondentes ao período.",
        "O reagendamento para o próprio dia do evento não será garantido e dependerá de concordância expressa da MAJA KIDS.")}
      ${sec(10, "CONDIÇÕES CLIMÁTICAS",
        "A segurança dos usuários, dos equipamentos e da equipe da MAJA KIDS terá prioridade em situações de chuva intensa, tempestades, raios, ventos fortes, alagamentos ou outras condições climáticas que tornem insegura a instalação ou utilização dos brinquedos.",
        "Caso as condições climáticas impeçam a realização segura do serviço antes da instalação, a MAJA KIDS poderá oferecer o reagendamento para nova data, condicionado à disponibilidade.",
        "Caso não seja possível encontrar nova data adequada, será apresentada ao CONTRATANTE solução compatível com a situação e com a legislação aplicável.",
        "Caso a condição climática se altere durante a utilização do brinquedo e sua continuidade passe a representar risco, a MAJA KIDS poderá determinar a interrupção imediata da utilização.",
        "Caso as condições voltem a ser seguras dentro do período originalmente contratado, a utilização poderá ser retomada.",
        "Caso não seja possível retomar a utilização durante o período originalmente contratado, serão registrados os períodos efetivamente utilizados e não utilizados.",
        "Nessa hipótese, o CONTRATANTE poderá optar, conforme as condições do caso, por: (a) receber um crédito proporcional ao período não utilizado, para utilização em futura contratação, sujeito à disponibilidade da MAJA KIDS; ou (b) receber reembolso proporcional ao período não utilizado.",
        "O cálculo do crédito ou reembolso será realizado de forma proporcional ao valor correspondente ao período não utilizado.",
        "A MAJA KIDS não será obrigada a retornar ao mesmo evento em outra data exclusivamente para cumprir as horas restantes de uma locação interrompida por condições climáticas, considerando os custos de transporte, equipe, montagem, desmontagem, limpeza e demais despesas operacionais envolvidas.")}
      ${sec(11, "IMPOSSIBILIDADE DE PRESTAÇÃO DO SERVIÇO PELA MAJA KIDS",
        "Caso a MAJA KIDS, por motivo justificável e alheio à sua vontade, fique impossibilitada de realizar a locação ou serviço contratado, comunicará o CONTRATANTE assim que possível.",
        "Nessa situação, será buscada, prioritariamente, a possibilidade de reagendamento.",
        "Caso o reagendamento não seja possível ou adequado, será realizada a devolução dos valores devidos ao CONTRATANTE, observada a legislação aplicável.")}
      ${sec(12, "SERVIÇOS E EQUIPAMENTOS ESPECÍFICOS",
        "Cada brinquedo ou serviço poderá possuir regras específicas de utilização, montagem, segurança, idade, peso, capacidade, espaço, energia elétrica ou necessidade de água.",
        "As especificações informadas pela MAJA KIDS deverão ser respeitadas integralmente.",
        "Quando houver regras específicas para determinado brinquedo ou serviço, estas integrarão o presente contrato, ainda que apresentadas em ficha técnica, catálogo, mensagem, orçamento ou documento complementar aceito pelo CONTRATANTE.")}
      ${sec(13, "RESPONSABILIDADE DAS PARTES",
        "A MAJA KIDS compromete-se a entregar os equipamentos em condições adequadas de utilização, observando as condições de segurança aplicáveis ao serviço contratado.",
        "O CONTRATANTE compromete-se a fornecer informações verdadeiras sobre o evento e o local de instalação e a cumprir as regras estabelecidas neste contrato.",
        "O CONTRATANTE será responsável por orientar seus convidados e usuários quanto às regras de utilização dos equipamentos.",
        "Cada parte responderá pelos danos que causar por sua própria conduta, nos limites estabelecidos pela legislação aplicável.",
        "Nenhuma disposição deste contrato deverá ser interpretada como exclusão ou renúncia a responsabilidades que não possam ser afastadas por contrato.")}
      ${sec(14, "COMUNICAÇÕES",
        "As comunicações relacionadas à contratação poderão ser realizadas por telefone, WhatsApp, e-mail ou outro meio eletrônico informado pelas partes.",
        "O CONTRATANTE deverá manter seus dados de contato atualizados para recebimento de informações relacionadas ao evento.")}
      ${sec(15, "ASSINATURA ELETRÔNICA",
        "As partes concordam que este contrato poderá ser assinado eletronicamente, inclusive por meio de plataforma de assinatura digital ou outro mecanismo eletrônico que permita identificar os signatários e demonstrar sua manifestação de vontade.",
        "A assinatura eletrônica será considerada manifestação de concordância com os termos deste contrato, observada a legislação aplicável.",
        "O CONTRATANTE declara que leu integralmente este contrato, compreendeu suas condições e teve oportunidade de esclarecer eventuais dúvidas antes da assinatura.")}
      ${sec(16, "DISPOSIÇÕES FINAIS",
        "Este contrato representa o acordo entre as partes quanto à locação dos brinquedos e/ou prestação dos serviços nele especificados.",
        "Eventuais alterações deverão ser registradas por escrito, inclusive por meio eletrônico.",
        "Caso alguma disposição deste contrato seja considerada inválida ou inexigível, as demais disposições permanecerão válidas naquilo que não forem afetadas.",
        "Este contrato será interpretado de acordo com a legislação brasileira, respeitando-se os direitos legalmente assegurados ao consumidor.",
        "O CONTRATANTE declara estar ciente das regras de utilização, segurança, supervisão, conservação e responsabilidade estabelecidas neste contrato.")}

      <section class="anexo">
      <h1>ANEXO I — TERMO DE RESPONSABILIDADE, ENTREGA E VISTORIA</h1>
      <p class="dados"><b>CONTRATANTE:</b> ${linha(r.cliente_nome)}</p>
      <p class="dados"><b>EVENTO:</b> ${"_".repeat(40)}</p>
      <p class="dados"><b>DATA:</b> ${dataBR(r.data)}</p>
      <p class="dados"><b>BRINQUEDO(S):</b> ${linha(lista, 50)}</p>
      <h3>CONDIÇÕES NA ENTREGA</h3>
      <ul class="caixas">${["Equipamento entregue em condições adequadas de utilização.", "Equipamento instalado conforme orientação da MAJA KIDS.", "Regras de utilização e segurança apresentadas ao CONTRATANTE.", "Limites de idade/peso/capacidade informados.", "Orientações sobre supervisão das crianças fornecidas.", "Registro fotográfico realizado."].map(caixa).join("")}</ul>
      <p class="dados"><b>Horário de início da utilização:</b> ${linha(r.hora_inicio, 10)}</p>
      <p class="dados"><b>Observações na entrega:</b><br>${"_".repeat(62)}<br>${"_".repeat(62)}</p>
      <h3>CONDIÇÕES NA DEVOLUÇÃO/RETIRADA</h3>
      <p class="dados"><b>Horário de término:</b> ${linha(r.hora_fim, 10)}</p>
      <ul class="caixas">${caixa("Equipamento devolvido/retirado sem danos aparentes.")}${caixa("Foram identificados danos ou alterações.")}</ul>
      <p class="dados"><b>Descrição:</b><br>${"_".repeat(62)}<br>${"_".repeat(62)}<br>${"_".repeat(62)}</p>
      <p class="dados"><b>Registro fotográfico realizado:</b> ☐ Sim &nbsp; ☐ Não</p>
      <p class="dados"><b>Observações adicionais:</b><br>${"_".repeat(62)}<br>${"_".repeat(62)}</p>
      <h3>DECLARAÇÃO DO CONTRATANTE</h3>
      ${p("Declaro que recebi as orientações de utilização e segurança dos brinquedos, estou ciente dos limites e regras estabelecidos neste contrato e comprometo-me a orientar os usuários e responsáveis presentes no evento quanto ao seu cumprimento.")}
      ${p("Declaro, ainda, estar ciente de que a supervisão geral das crianças permanece sob responsabilidade dos pais, responsáveis legais e do CONTRATANTE, sem prejuízo das responsabilidades legalmente atribuídas à MAJA KIDS.")}
      ${p("Declaro estar ciente de que danos causados por utilização inadequada, negligência ou descumprimento das regras poderão gerar responsabilidade pelo prejuízo comprovadamente causado, inclusive pela substituição do equipamento quando esta for necessária.")}
      <p class="dados"><b>Local e data:</b> ${hojeBR} Materlândia-MG</p>
      <p class="dados"><b>CONTRATANTE:</b> ${linha(r.cliente_nome)}</p>
      <p class="dados"><b>CPF/CNPJ:</b> ${linha(r.documento)}</p>
      <p class="dados"><b>Assinatura eletrônica:</b> ${"_".repeat(40)}</p>
      <p class="dados" style="margin-top:18px"><b>MAJA KIDS — Maria Júlia Pinho Magalhães</b></p>
      <p class="dados"><b>Assinatura eletrônica:</b> ${"_".repeat(40)}</p>
      </section>`;
    folha.contentEditable = "true";
    folha.spellcheck = false;
  } catch (e) { folha.innerHTML = `<p class="erro-msg">${esc(e.message)}</p>`; }
})();
