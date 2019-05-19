takoyaki.eth
============

First and most importantly, it lets you register an ENS name with only signing a single transaction, while still properly having a complete commit/reveal period. It does this by using a technique called one-time keyless transactions.

Second, it issues a unique artistic token, assigned to the ENS name for life. They are procedurally generated. And they are formed over time, incrementally providing instant gratification, while keeping a person present. It's basically the toy in the box of a cereal box, designed to trick you into doing something serious (like eat breakfast) while making it fun (by giving you a toy).

Third, it bootstraps a RandDAO-like random-number generator, using the ENS commit-reveals. The non-transitive nature of ENS names makes it ideal for this purpose.


Inspiration
-----------

We adore ENS. It is awesome. One of the most important part of internet infrastructure since staples such as DNS or SSL. The problem is that it is still a bit hard to use, requiring multiple transactions, and a bit of time investment, which can quickly detour people who don't see the immediate value.


How we built it
---------------

It is a collection of scripts for testing and experimenting purposes, but otherwise is a single Solidity contract and a single-page web page. The vast majority of the effort was getting the one-time keyless transactions to run smoothly and interface with the new ENS registrar, as we are far more experienced with the old, now deprecated API.


Challenges we ran into
----------------------

A few key pieces of terminology were changed, but with some amazing help from the ENS team (w00t Makoto), we were off to the races.

Accomplishments that we're proud of
-----------------------------------

It works. There are still a lot of assets we can add for the procedural generation, but we will likely look into finding an actual artist for that... Our art skills have already been pushed to the limit. :)

What we learned
---------------

There are a lot of moving parts... Beware of moving parts.


What's next for Takoyaki
------------------------

The technique used can be used in conjunction with the actual EthController, allowing single-signed-transactions to register top-level domains. We would also be interested in helping getting the commit-reveal internals exposed in a future version of the ETH registrar.

Also, a landing page, which shows recently purchased names along with their Takoyaki character.
