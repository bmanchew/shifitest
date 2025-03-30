import financialAgent from "./financial";
import contractAgent from "./contract";
import { injectTransferTools } from "../utils";

// Set up downstream agents for each agent
financialAgent.downstreamAgents = [contractAgent];
contractAgent.downstreamAgents = [financialAgent];

// Inject transfer tools to allow agents to transfer to each other
const agents = injectTransferTools([
  financialAgent,
  contractAgent
]);

export default agents;