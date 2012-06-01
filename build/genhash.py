import re
from hashlib import sha256

f = open('update.rdf', 'r')
u = ''.join(f.readlines())
f.close()


h = sha256(open('anticontainer.xpi', 'rb').read()).hexdigest()
u = re.sub(r'"sha256:.*?"', r'"sha256:%s"' % h, u)

print h

o = open('update.rdf', 'wb')
o.write(u)
o.close()