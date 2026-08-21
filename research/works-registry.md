# Corpus work registry

**Registry audit date:** 2026-07-20  
**Metadata cutoff:** 2026-07-20  
**Scope:** both topic bibliographies and all 85 topic-local source notes

This is the canonical identity layer for the research corpus. A `W###` identifies a **work**, not a file, topic, version, or claim. Topic IDs (`H##` and `M##`) are aliases retained for compatibility. Once assigned, a W ID is immutable: do not renumber or reuse it. A correction, new version, or publication of the same intellectual work updates the existing row; a genuinely distinct work receives a new W ID. Keep superseded aliases and identifiers in the row.

“Unknown” means the reviewed corpus does not establish the value; it is not an invitation to infer it from a template, URL, or author affiliation. Versionless arXiv identifiers identify a work but do not establish the exact version reviewed. Canonical records favor the published/proceedings record when one is verified and otherwise use the version-independent arXiv work record. “Version reviewed” records the artifact supporting the current notes, which can differ from the canonical published record.

## Registry

| W ID | Topic aliases | Exact title | Stable identifiers recorded in the corpus | Canonical record | Version reviewed / acquisition provenance | Publication maturity at cutoff |
|---|---|---|---|---|---|---|
| W001 | H01 | *From Question Answering to Task Completion: A Survey on Agent System and Harness Design* | arXiv:2606.20683 | [arXiv](https://arxiv.org/abs/2606.20683) | arXiv v1; full HTML | Preprint / survey; not peer reviewed |
| W002 | H02 | *Code as Agent Harness* | arXiv:2605.18747 | [arXiv](https://arxiv.org/abs/2605.18747) | arXiv v1; full HTML | Preprint / survey |
| W003 | H03 | *SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering* | arXiv:2405.15793 | [arXiv](https://arxiv.org/abs/2405.15793) | Exact arXiv version unknown; arXiv record/PDF links checked; numerical tables not directly primary-reviewed in this audit | Peer reviewed; NeurIPS 2024 |
| W004 | H04 | *Agentless: Demystifying LLM-based Software Engineering Agents* | DOI:10.1145/3715754; arXiv:2407.01489 | [DOI](https://doi.org/10.1145/3715754) | arXiv v2 full HTML; publication metadata cross-checked | Peer reviewed; FSE 2025 / PACMSE |
| W005 | H05, M03 | *ContextBench: A Benchmark for Context Retrieval in Coding Agents* | arXiv:2602.05892 | [arXiv](https://arxiv.org/abs/2602.05892) | arXiv v3 (2026-02-11); full HTML | Preprint / benchmark; no peer-reviewed venue verified |
| W006 | H06, M25 | *AI Agents That Matter* | OpenReview:Zy4uFzMviZ; arXiv:2407.01502 | [TMLR / OpenReview](https://openreview.net/forum?id=Zy4uFzMviZ) | Extracted claims use arXiv v1; publication metadata checked against OpenReview | Peer reviewed; TMLR 2025 |
| W007 | H07 | *SWE-bench: Can Language Models Resolve Real-World GitHub Issues?* | OpenReview:VTF8yNQM66; arXiv:2310.06770 | [ICLR / OpenReview](https://openreview.net/forum?id=VTF8yNQM66) | Exact paper/arXiv version unknown; proceedings/arXiv metadata checked | Peer reviewed / benchmark; ICLR 2024 |
| W008 | H08 | *OpenHands: An Open Platform for AI Software Developers as Generalist Agents* | OpenReview:OJd3ayDDoF; arXiv:2407.16741 | [ICLR / OpenReview](https://openreview.net/forum?id=OJd3ayDDoF) | Exact paper/arXiv version unknown; primary metadata checked | Peer reviewed / systems paper; ICLR 2025 |
| W009 | H09 | *ReAct: Synergizing Reasoning and Acting in Language Models* | OpenReview:WE_vluYUL-X; arXiv:2210.03629 | [ICLR / OpenReview](https://openreview.net/forum?id=WE_vluYUL-X) | arXiv v3 camera-ready metadata and abstract; full text not acquired in the main thread | Peer reviewed; ICLR 2023 |
| W010 | H10, M10 | *Reflexion: Language Agents with Verbal Reinforcement Learning* | arXiv:2303.11366; NeurIPS paper hash:1b44b878bb782e6954cd888628510e90 | [NeurIPS 2023](https://proceedings.neurips.cc/paper_files/paper/2023/hash/1b44b878bb782e6954cd888628510e90-Abstract-Conference.html) | NeurIPS paper / arXiv v4; paper and tables reviewed | Peer reviewed; NeurIPS 2023 |
| W011 | H11 | *Magentic-One: A Generalist Multi-Agent System for Solving Complex Tasks* | arXiv:2411.04468 | [arXiv](https://arxiv.org/abs/2411.04468) | Exact arXiv version unknown; primary record and paper reviewed | Preprint / system report in reviewed record |
| W012 | H12 | *Why Do Multi-Agent LLM Systems Fail?* | arXiv:2503.13657 | [arXiv](https://arxiv.org/abs/2503.13657) | Exact arXiv/proceedings version unknown; primary paper reviewed | Peer reviewed / empirical failure analysis; NeurIPS 2025 Datasets and Benchmarks |
| W013 | H13, M22 | *AgentDojo: A Dynamic Environment to Evaluate Prompt Injection Attacks and Defenses for LLM Agents* | DOI:10.52202/079017-2636; arXiv:2406.13352; data DOI:10.5281/zenodo.12528188 | [DOI](https://doi.org/10.52202/079017-2636) | NeurIPS paper / arXiv v3; full primary paper reviewed | Peer reviewed / benchmark; NeurIPS 2024 Datasets and Benchmarks |
| W014 | H14 | *Identifying the Risks of LM Agents with an LM-Emulated Sandbox* | OpenReview:GEcwtMk1uA; arXiv:2309.15817 | [ICLR / OpenReview](https://openreview.net/forum?id=GEcwtMk1uA) | Exact paper/arXiv version unknown; primary paper reviewed by safety thread | Peer reviewed; ICLR 2024 |
| W015 | H15 | *WebArena: A Realistic Web Environment for Building Autonomous Agents* | OpenReview:oKn9c6ytLx; arXiv:2307.13854 | [ICLR / OpenReview](https://openreview.net/forum?id=oKn9c6ytLx) | Exact paper/arXiv version unknown; primary paper reviewed | Peer reviewed / benchmark; ICLR 2024 |
| W016 | H16 | *AgentBench: Evaluating LLMs as Agents* | OpenReview:zAdUB0aCTQ; arXiv:2308.03688 | [ICLR / OpenReview](https://openreview.net/forum?id=zAdUB0aCTQ) | Exact paper/arXiv version unknown; proceedings/arXiv metadata checked | Peer reviewed / benchmark; ICLR 2024 |
| W017 | H17, M05 | *RepoCoder: Repository-Level Code Completion Through Iterative Retrieval and Generation* | DOI:10.18653/v1/2023.emnlp-main.151; ACL:2023.emnlp-main.151 | [ACL Anthology](https://aclanthology.org/2023.emnlp-main.151/) | EMNLP proceedings paper; official page and PDF tables reviewed | Peer reviewed; EMNLP 2023 |
| W018 | H18, M06 | *Repoformer: Selective Retrieval for Repository-Level Code Completion* | PMLR:v235/wu24a | [PMLR](https://proceedings.mlr.press/v235/wu24a.html) | ICML proceedings / arXiv v2 (2024-06-04); official page and PDF tables reviewed | Peer reviewed; ICML 2024 |
| W019 | H19 | *CodePlan: Repository-level Coding using LLMs and Planning* | DOI:10.1145/3643757 | [DOI](https://doi.org/10.1145/3643757) | Published primary paper PDF; tables and cited pages reviewed | Peer reviewed; FSE 2024 / PACMSE |
| W020 | H20 | *AutoCodeRover: Autonomous Program Improvement* | DOI:10.1145/3650212.3680384; arXiv:2404.05427 | [DOI](https://doi.org/10.1145/3650212.3680384) | Published primary paper PDF; exact arXiv version unknown | Peer reviewed; ISSTA 2024 |
| W021 | H21 | *SWE-Pruner: Self-Adaptive Context Pruning for Coding Agents* | arXiv:2601.16746 | [arXiv](https://arxiv.org/abs/2601.16746) | arXiv v4; primary PDF and v4 metadata reviewed | Preprint |
| W022 | H22 | *What Context Does a Coding Agent Actually Need to Act?* | arXiv:2607.09691 | [arXiv](https://arxiv.org/abs/2607.09691) | arXiv v1; primary PDF and metadata reviewed | Preprint |
| W023 | H23, M26 | *τ-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains* | OpenReview:roNSXZpUDN; arXiv:2406.12045 | [ICLR / OpenReview](https://openreview.net/forum?id=roNSXZpUDN) | ICLR paper / arXiv; exact arXiv version unknown | Peer reviewed / benchmark; ICLR 2025 |
| W024 | H24 | *ToolSandbox: A Stateful, Conversational, Interactive Evaluation Benchmark for LLM Tool Use Capabilities* | DOI:10.18653/v1/2025.findings-naacl.65; ACL:2025.findings-naacl.65; arXiv:2408.04682 | [ACL Anthology](https://aclanthology.org/2025.findings-naacl.65/) | Findings of NAACL proceedings paper; primary paper reviewed | Peer reviewed; Findings of NAACL 2025 |
| W025 | H25 | *IsolateGPT: An Execution Isolation Architecture for LLM-Based Agentic Systems* | DOI:10.14722/ndss.2025.241131; arXiv:2403.04960 | [DOI](https://doi.org/10.14722/ndss.2025.241131) | NDSS proceedings paper; exact arXiv version unknown | Peer reviewed; NDSS 2025 |
| W026 | H26 | *StruQ: Defending Against Prompt Injection with Structured Queries* | arXiv:2402.06363 | [USENIX Security](https://www.usenix.org/conference/usenixsecurity25/presentation/chen-sizhe) | USENIX proceedings paper; exact arXiv version unknown | Peer reviewed; USENIX Security 2025 |
| W027 | H27, M23 | *Defeating Prompt Injections by Design* | arXiv:2503.18813 | [arXiv](https://arxiv.org/abs/2503.18813) | arXiv v2; primary paper reviewed | Preprint; no proceedings publication independently verified |
| W028 | H28, M01 | *LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory* | OpenReview:pZiyCaVuti; arXiv:2410.10813 | [ICLR / OpenReview](https://openreview.net/forum?id=pZiyCaVuti) | ICLR paper / arXiv v2 (2025-03-04); full paper and tables reviewed | Peer reviewed / benchmark; ICLR 2025 |
| W029 | H29, M14 | *TapeAgents: A Holistic Framework for Agent Development and Optimization* | arXiv:2412.08445 | [arXiv](https://arxiv.org/abs/2412.08445) | arXiv v1 (2024-12-11); primary paper and tables reviewed | Technical report / preprint |
| W030 | H30, M20 | *Single-Agent LLMs Outperform Multi-Agent Systems on Multi-Hop Reasoning Under Equal Thinking Token Budgets* | arXiv:2604.02460 | [arXiv](https://arxiv.org/abs/2604.02460) | arXiv v2; primary paper reviewed | Preprint |
| W031 | H31, M11 | *ExpeL: LLM Agents Are Experiential Learners* | DOI:10.1609/aaai.v38i17.29936; arXiv:2308.10144 | [DOI](https://doi.org/10.1609/aaai.v38i17.29936) | AAAI paper / arXiv v3; primary paper and tables reviewed | Peer reviewed; AAAI 2024 |
| W032 | H32 | *Harness-Bench: Measuring Harness Effects across Models in Realistic Agent Workflows* | arXiv:2605.27922 | [arXiv](https://arxiv.org/abs/2605.27922) | arXiv v1, submitted 2026-05-27; full HTML | Preprint / benchmark; not peer reviewed |
| W033 | H33 | *Meta-Harness: End-to-End Optimization of Model Harnesses* | arXiv:2603.28052 | [arXiv](https://arxiv.org/abs/2603.28052) | arXiv v1, submitted 2026-03-30; full HTML | Preprint |
| W034 | H34 | *Don’t Blame the Large Language Model: How Scaffolding Evolution Shapes Coding Agent Quality* | arXiv:2607.03691 | [arXiv](https://arxiv.org/abs/2607.03691) | arXiv v1, submitted 2026-07-04; full HTML | Preprint / empirical software-engineering study; TOSEM publication not verified |
| W035 | M02 | *Evaluating Very Long-Term Conversational Memory of LLM Agents* | DOI:10.18653/v1/2024.acl-long.747; ACL:2024.acl-long.747; arXiv:2402.17753 | [ACL Anthology](https://aclanthology.org/2024.acl-long.747/) | ACL proceedings paper / arXiv v1; full text and metadata inspected | Peer reviewed / benchmark; ACL 2024 |
| W036 | M04 | *Lost in the Middle: How Language Models Use Long Contexts* | DOI:10.1162/tacl_a_00638; ACL:2024.tacl-1.9 | [ACL Anthology](https://aclanthology.org/2024.tacl-1.9/) | TACL 2024 proceedings text | Peer reviewed; TACL 12 (2024) |
| W037 | M07 | *The Complexity Trap: Simple Observation Masking Is as Efficient as LLM Summarization for Agent Context Management* | arXiv:2508.21433 | [arXiv](https://arxiv.org/abs/2508.21433) | arXiv v3 (2025-10-27); full HTML | Preprint / workshop manuscript; archival peer review not verified |
| W038 | M08 | *MemGPT: Towards LLMs as Operating Systems* | arXiv:2310.08560 | [arXiv](https://arxiv.org/abs/2310.08560) | arXiv v2; primary paper/PDF evidence reviewed | Preprint; no peer-reviewed venue verified |
| W039 | M09 | *Generative Agents: Interactive Simulacra of Human Behavior* | DOI:10.1145/3586183.3606763; arXiv:2304.03442 | [DOI](https://doi.org/10.1145/3586183.3606763) | UIST paper / arXiv primary text; exact arXiv version unknown | Peer reviewed; UIST 2023 |
| W040 | M12 | *Agent Workflow Memory* | arXiv:2409.07429 | [arXiv](https://arxiv.org/abs/2409.07429) | arXiv v1 (2024-09-11); full HTML/PDF evidence reviewed | Preprint; no archival venue independently verified |
| W041 | M13 | *Voyager: An Open-Ended Embodied Agent with Large Language Models* | OpenReview:ehfRiF0R3a; arXiv:2305.16291 | [TMLR / OpenReview](https://openreview.net/forum?id=ehfRiF0R3a) | TMLR paper / arXiv v2; full text and tables reviewed | Peer reviewed; TMLR 2024 |
| W042 | M15 | *Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory* | arXiv:2504.19413 | [arXiv](https://arxiv.org/abs/2504.19413) | arXiv v1 (2025-04-28); full HTML | Preprint / vendor-authored system paper |
| W043 | M16 | *A-TMA: Decoupling State-Aware Memory Failures in Long-Term Agent Memory* | arXiv:2607.01935 | [arXiv](https://arxiv.org/abs/2607.01935) | arXiv v2 (2026-07-08); full HTML | Preprint |
| W044 | M17 | *ContextWeaver: Selective and Dependency-Structured Memory Construction for LLM Agents* | arXiv:2604.23069 | [arXiv](https://arxiv.org/abs/2604.23069) | arXiv v1 (2026-04-24); full HTML | Preprint |
| W045 | M18 | *Not All Skills Help: Measuring and Repairing Agent Knowledge* | arXiv:2606.15390 | [arXiv](https://arxiv.org/abs/2606.15390) | arXiv v1 (2026-06-13); full HTML | Preprint |
| W046 | M19 | *Memory as a Controlled Process: Learned Adaptive Memory Management for LLM Agents* | arXiv:2607.13591 | [arXiv](https://arxiv.org/abs/2607.13591) | arXiv v1 (2026-07-15); full HTML | Preprint |
| W047 | M21 | *AgentPoison: Red-teaming LLM Agents via Poisoning Memory or Knowledge Bases* | DOI:10.52202/079017-4136; arXiv:2407.12784 | [DOI](https://doi.org/10.52202/079017-4136) | NeurIPS paper / arXiv v1; full text and proceedings status inspected | Peer reviewed; NeurIPS 2024 |
| W048 | M24 | *Memory Poisoning Attack and Defense on Memory Based LLM-Agents* | arXiv:2601.05504 | [arXiv](https://arxiv.org/abs/2601.05504) | arXiv v2 (2026-01-12); full HTML | Preprint |
| W049 | M27 | *Interleaving Retrieval with Chain-of-Thought Reasoning for Knowledge-Intensive Multi-Step Questions* | DOI:10.18653/v1/2023.acl-long.557; ACL:2023.acl-long.557 | [ACL Anthology](https://aclanthology.org/2023.acl-long.557/) | ACL proceedings paper; primary PDF/tables inspected | Peer reviewed; ACL 2023 |
| W050 | M28 | *Active Retrieval Augmented Generation* | DOI:10.18653/v1/2023.emnlp-main.495; ACL:2023.emnlp-main.495 | [ACL Anthology](https://aclanthology.org/2023.emnlp-main.495/) | EMNLP proceedings paper; primary PDF/tables inspected | Peer reviewed; EMNLP 2023 |
| W051 | M29 | *Query Rewriting in Retrieval-Augmented Large Language Models* | DOI:10.18653/v1/2023.emnlp-main.322; ACL:2023.emnlp-main.322 | [ACL Anthology](https://aclanthology.org/2023.emnlp-main.322/) | EMNLP proceedings paper; primary PDF/tables inspected | Peer reviewed; EMNLP 2023 |
| W052 | M30 | *RAPTOR: Recursive Abstractive Processing for Tree-Organized Retrieval* | OpenReview:GN921JHCRw | [ICLR / OpenReview](https://openreview.net/forum?id=GN921JHCRw) | ICLR proceedings paper; primary paper/tables inspected | Peer reviewed; ICLR 2024 |
| W053 | M31 | *Large Language Models Can Be Easily Distracted by Irrelevant Context* | PMLR:v202/shi23a | [PMLR](https://proceedings.mlr.press/v202/shi23a.html) | ICML proceedings paper; official page/PDF evidence inspected | Peer reviewed; ICML 2023 |
| W054 | M32 | *Evaluating Memory Structure in LLM Agents* | arXiv:2602.11243 | [arXiv](https://arxiv.org/abs/2602.11243) | arXiv v2 (2026-05-22); metadata and primary PDF evidence reviewed | Preprint / work in progress |
| W055 | M33 | *Evaluating Memory in LLM Agents via Incremental Multi-Turn Interactions* | arXiv:2507.05257 | [arXiv](https://arxiv.org/abs/2507.05257) | arXiv v4 (2026-06-28); metadata and primary tables reviewed | Preprint / benchmark; acceptance not inferred from template |
| W056 | M34 | *Memory Injection Attacks on LLM Agents via Query-Only Interaction* | arXiv:2503.03704 | [arXiv](https://arxiv.org/abs/2503.03704) | arXiv v5 (2026-02-12); primary paper evidence reviewed | Preprint; no proceedings record verified |
| W057 | H35 | *Sagas* | DOI:10.1145/38713.38742 | [DOI](https://doi.org/10.1145/38713.38742) | Published SIGMOD 1987 paper, pp. 249–259; primary PDF and DOI metadata reviewed | Peer reviewed; SIGMOD 1987 |
| W058 | H36 | *Implementing Remote Procedure Calls* | DOI:10.1145/2080.357392 | [DOI](https://doi.org/10.1145/2080.357392) | Published TOCS 2(1) paper, pp. 39–59; Xerox report scan and DOI metadata reviewed | Peer reviewed; ACM TOCS 1984 |
| W059 | H37 | *Leases: An Efficient Fault-Tolerant Mechanism for Distributed File Cache Consistency* | DOI:10.1145/74850.74870 | [DOI](https://doi.org/10.1145/74850.74870) | Published SOSP 1989 paper, pp. 202–210; primary PDF and DOI metadata reviewed | Peer reviewed; SOSP 1989 |
| W060 | H38 | *In Search of an Understandable Consensus Algorithm* | USENIX record:184040; ISBN:978-1-931971-10-2 | [USENIX](https://www.usenix.org/conference/atc14/technical-sessions/presentation/ongaro) | USENIX ATC 2014 proceedings paper, pp. 305–319; proceedings page and paper reviewed | Peer reviewed; USENIX ATC 2014 |
| W061 | H39 | *Transaction Processing: Concepts and Techniques* | ISBN:978-1-55860-190-1 | [Publisher](https://www.elsevier.com/books/transaction-processing/gray/978-1-55860-190-1) | First edition; publisher catalog/contents and cited pages reviewed; publisher dates it 1992 | Authoritative book; Morgan Kaufmann |
| W062 | H40 | *On Optimistic Methods for Concurrency Control* | DOI:10.1145/319566.319567 | [DOI](https://doi.org/10.1145/319566.319567) | Published ACM TODS 6(2) paper, pp. 213–226; primary paper and DOI metadata reviewed | Peer reviewed; ACM TODS 1981 |
| W063 | H41 | *HTTP Semantics* | DOI:10.17487/RFC9110; RFC:9110; STD:97 | [RFC Editor](https://www.rfc-editor.org/rfc/rfc9110.html) | RFC 9110 Internet Standard, June 2022; full canonical HTML and errata link reviewed | Internet Standard; IETF consensus/public review |
| W064 | H42 | *The Chubby Lock Service for Loosely-Coupled Distributed Systems* | USENIX OSDI 2006 record; no DOI assigned | [Google Research](https://research.google/pubs/the-chubby-lock-service-for-loosely-coupled-distributed-systems/) | OSDI 2006 paper, pp. 335–350; author-institution page and primary PDF reviewed | Peer reviewed; OSDI 2006 |
| W065 | H43 | *Implementing Linearizability at Large Scale and Low Latency* | DOI:10.1145/2815400.2815416 | [DOI](https://doi.org/10.1145/2815400.2815416) | Published SOSP 2015 paper, pp. 71–86; primary paper and DOI metadata reviewed | Peer reviewed; SOSP 2015 |
| W066 | H44 | *End-to-End Arguments in System Design* | DOI:10.1145/357401.357402 | [DOI](https://doi.org/10.1145/357401.357402) | Published TOCS 2(4) paper, pp. 277–288; author-hosted PDF and DOI metadata reviewed | Peer reviewed; ACM TOCS 1984 |
| W067 | H45 | *ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging* | DOI:10.1145/128765.128770 | [DOI](https://doi.org/10.1145/128765.128770) | Published ACM TODS 17(1) paper, pp. 94–162; primary paper and DOI metadata reviewed | Peer reviewed; ACM TODS 1992 |
| W068 | H46 | *FoundationDB: A Distributed Unbundled Transactional Key Value Store* | DOI:10.1145/3448016.3457559 | [DOI](https://doi.org/10.1145/3448016.3457559) | Published SIGMOD 2021 paper, pp. 2653–2666; primary paper and DOI metadata reviewed | Peer reviewed; SIGMOD 2021 |
| W069 | H47 | *Consensus on Transaction Commit* | DOI:10.1145/1132863.1132867; arXiv:cs/0408036 | [DOI](https://doi.org/10.1145/1132863.1132867) | Published ACM TODS 31(1) paper, pp. 133–160; author page, primary paper, and DOI metadata reviewed | Peer reviewed; ACM TODS 2006 |
| W070 | H48 | *Life beyond Distributed Transactions: an Apostate's Opinion* | DOI:10.1145/3012426.3025012 (later Queue reprint); CIDR 2007 pp. 132–141 | [CIDR PDF](https://www.cidrdb.org/cidr2007/papers/cidr07p15.pdf) | Original CIDR 2007 position paper reviewed; later 2016 ACM Queue reprint identity recorded separately | Position paper / practitioner reprint |
| W071 | H49 | *Atomix: Timely, Transactional Tool Use for Reliable Agentic Workflows* | arXiv:2602.14849v2; DOI:10.48550/arXiv.2602.14849 | [arXiv](https://arxiv.org/abs/2602.14849v2) | arXiv v2 (2026-05-29); full primary paper and artifact metadata reviewed | Preprint / direct agent experiment |
| W072 | H50 | *Robust Agent Compensation (RAC): Teaching AI Agents to Compensate* | DOI:10.1145/3786335.3813141; arXiv:2605.03409v2 | [DOI](https://doi.org/10.1145/3786335.3813141) | Published CAIS 2026 paper, pp. 253–262; proceedings metadata and open paper reviewed | Peer reviewed; ACM CAIS 2026 |
| W073 | H51 | *Cordon: Semantic Transactions for Tool-Using LLM Agents* | arXiv:2606.17573v1; DOI:10.48550/arXiv.2606.17573 | [arXiv](https://arxiv.org/abs/2606.17573v1) | arXiv v1 (2026-06-16); full primary paper reviewed; future venue header not treated as verified | Preprint / direct agent experiment |

## Reconciled duplicate mappings

These are the 12 cross-topic duplicate work records. They collapse 24 topic-local records into 12 works; the topic notes remain independent compatibility views and may differ in extraction depth.

| W ID | Harness alias | Memory alias | Identity key(s) used to reconcile |
|---|---|---|---|
| W005 | H05 | M03 | arXiv:2602.05892 — ContextBench |
| W006 | H06 | M25 | OpenReview:Zy4uFzMviZ / arXiv:2407.01502 — AI Agents That Matter |
| W010 | H10 | M10 | arXiv:2303.11366 — Reflexion |
| W013 | H13 | M22 | DOI:10.52202/079017-2636 / arXiv:2406.13352 — AgentDojo |
| W017 | H17 | M05 | DOI:10.18653/v1/2023.emnlp-main.151 — RepoCoder |
| W018 | H18 | M06 | PMLR:v235/wu24a — Repoformer |
| W023 | H23 | M26 | arXiv:2406.12045 / OpenReview:roNSXZpUDN — τ-bench |
| W027 | H27 | M23 | arXiv:2503.18813 — CaMeL |
| W028 | H28 | M01 | arXiv:2410.10813 / OpenReview:pZiyCaVuti — LongMemEval |
| W029 | H29 | M14 | arXiv:2412.08445 — TapeAgents |
| W030 | H30 | M20 | arXiv:2604.02460 — equal-token multi-agent study |
| W031 | H31 | M11 | DOI:10.1609/aaai.v38i17.29936 / arXiv:2308.10144 — ExpeL |

## 2026-08-20 addition: five 2026 agent-harness preprints

| W ID | Topic aliases | Exact title | Stable identifiers recorded in the corpus | Canonical record | Version reviewed / acquisition provenance | Publication maturity at cutoff |
|---|---|---|---|---|---|---|
| W074 | H52 | *ACM: Agentic Context Management for Long Horizon Tasks* | arXiv:2607.23809 | [arXiv](https://arxiv.org/abs/2607.23809) | Version not independently verified; abstract page scraped 2026-08-20 | Preprint; abstract-only acquisition |
| W075 | H53 | *Diagnosis Before Recovery: Turning Agent Failures into Selective Self-Correction (DARC)* | arXiv:2608.11772 | [arXiv](https://arxiv.org/abs/2608.11772) | Version not independently verified; abstract page scraped 2026-08-20 | Preprint; abstract-only acquisition |
| W076 | H54 | *Looping Is Not Reliability: State-Bound Evidence and Typed Revision Contracts for Agentic Code Repair* | arXiv:2607.24604 | [arXiv](https://arxiv.org/abs/2607.24604) | Version not independently verified; abstract page scraped 2026-08-20 | Preprint; abstract-only acquisition |
| W077 | H55 | *Self-Authored Verification Is Unreliable in Heuristic Self-Improving Agents (SEAL)* | arXiv:2607.24300 | [arXiv](https://arxiv.org/abs/2607.24300) | Version not independently verified; abstract page scraped 2026-08-20 | Preprint; abstract-only acquisition |
| W078 | H56 | *EA-Graph: Artifact-Anchored Verification Memory for Coding Agents under Upstream Drift* | arXiv:2608.04278 | [arXiv](https://arxiv.org/abs/2608.04278) | Version not independently verified; abstract page scraped 2026-08-20 | Preprint; abstract-only acquisition |

These five works were discovered via a web-search sweep for 2026-07-15 through 2026-08-20 agent-harness research, then abstract-verified directly against their arXiv pages on 2026-08-20 (search-log rows H-20260820-001 through H-20260820-005). Full text was not acquired; every linked evidence observation is capped at grade D under the abstract/metadata-only rule in `confidence-rubric.md`.

## Audit totals

- Topic bibliography entries: **90** (`56 H + 34 M`).
- Topic source-note files: **90** (`56 H + 34 M`).
- Cross-topic duplicate pairs: **12**, representing **24** aliases.
- Distinct registered works: **78** (`90 - 12`).
- W IDs: **W001–W078**, contiguous and unique.
- Topic aliases mapped: **90/90**, each exactly once; W IDs with two aliases: **12**; W IDs with one alias: **66**.
- Additional identifier duplicates found beyond the 12 reconciled pairs: **0** after normalizing DOI case/prefix, arXiv version suffixes, OpenReview IDs, ACL IDs, and PMLR paths.
- W074–W078 are abstract-only acquisitions pending full-text review; they do not change the audit's identifier-duplication result.
