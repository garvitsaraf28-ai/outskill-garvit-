/**
 * warRoomAgentByAgent - READ ONLY. Writes nothing, anywhere.
 *
 * Prints what the board gives EVERY roster agent this month, so it can be
 * put beside CBC's "Realised Revenue" column and the disagreement read off
 * directly instead of inferred.
 *
 * This is the question the last diagnostic could not answer. It proved
 * only 13.50 L of mdl_Payments reaches the 86 roster agents, while CBC
 * says those same people realised 25.02 L - and the per-agent figures that
 * DO appear match CBC to the rupee. So nobody is being miscounted; some
 * people are missing altogether. This names them.
 *
 * Paste as its own file. It is deliberately tiny, because the last one was
 * 440 lines and the paste stopped at 150.
 */
function warRoomAgentByAgent() {
  var p = wr_build_('');
  var P = wr_pad_, M = wr_money_;

  Logger.log('=== EVERY ROSTER AGENT ===   ' + p.meta.month + '   ' + p.meta.windowLabel);
  Logger.log('  board total : ' + M(p.totals.revenue) + '   ' + p.totals.units + ' units   ' +
             p.agents.length + ' agents on the roster');
  Logger.log('');
  Logger.log('  Put this beside CBC\'s Realised Revenue column. A name CBC pays and');
  Logger.log('  this shows as 0 is one whose payments are not reaching mdl_Payments');
  Logger.log('  under this spelling - that is the whole fault, and the amount beside');
  Logger.log('  it in CBC is what the board is short by.');
  Logger.log('');
  Logger.log('  ' + P('AGENT', 28) + P('MANAGER', 18) + P('TEAM', 9) +
             P('REVENUE', 12) + 'UNITS');

  var zero = 0;
  for (var i = 0; i < p.agents.length; i++) {
    var a = p.agents[i];
    if (!a.revenue) zero++;
    Logger.log('  ' + P(a.name, 28) + P(a.manager, 18) + P(a.team, 9) +
               P(a.revenue ? M(a.revenue) : '-', 12) + (a.units || ''));
  }

  Logger.log('');
  Logger.log('  with money : ' + (p.agents.length - zero));
  Logger.log('  at zero    : ' + zero);
  Logger.log('');
  Logger.log('  Nothing was written. This only reports.');
}
