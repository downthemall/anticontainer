from os.path import commonprefix
from re import sub

def commonsuffix(lst):
    rv = commonprefix(list(map(lambda x: x[::-1], lst)))
    if rv:
        rv = rv[::-1]
    return rv

def combine(*seqin):
    '''returns a list of all combinations of argument sequences.
for example: combine((1,2),(3,4)) returns
[[1, 3], [1, 4], [2, 3], [2, 4]]'''
    def rloop(seqin,listout,comb):
        '''recursive looping function'''
        if seqin:                       # any more sequences to process?
            for item in seqin[0]:
                newcomb=comb+[item]     # add next item to current comb
                # call rloop w/ rem seqs, newcomb
                rloop(seqin[1:],listout,newcomb)
        else:                           # processing last sequence
            listout.append(comb)        # comb finished, add to list
    listout=[]                      # listout initialization
    rloop(seqin,listout,[])         # start recursive process
    return listout

# XXX need to protect against trailing single backslash
def biggestgroup(slist, fngroup):
    d = dict()
    for k, x in map(lambda x: (fngroup(x), x), filter(lambda x: x[1] != x[0], combine(slist, slist))):
        if not k or k.count('(') != k.count(')'):
            continue
        if k in d:
            d[k] += x
        else:
            d[k] = x
    if not len(d):
        return None, None
    fix = max(d.keys(),key=lambda x: len(x))
    rlist = list(set(d[fix]))[:]
    if len(rlist) < 2:
        return None, None
    return fix, rlist

def mergeex(slist):
    slist = list(slist)
    while len(slist) > 1:
        pre, prelist = biggestgroup(slist, commonprefix)
        if not pre:
            break
        slist = list(filter(lambda x: x not in prelist, slist))
        prelist = list(set(map(lambda x: x[len(pre):], prelist)))
        while len(prelist) > 1:
            suf, suflist = biggestgroup(prelist, commonsuffix)
            if not suf:
                break
            prelist = list(filter(lambda x: x not in suflist, prelist))
            suflist = list(set(map(lambda x: x[:-len(suf)], suflist)))
            if len(suflist) > 1:
                prelist += "(?:%s)%s" % ("|".join(suflist), suf),
            else:
                prelist += "%s%s" % ("".join(suflist), suf),

        if len(prelist) > 1:
            pi = "%s(?:%s)" % (pre, "|".join(prelist))
        else:
            pi = "%s%s" % (pre, "".join(prelist))
        slist += pi,

    return '|'.join(slist)


def main():
    l = []
    for line in fileinput():
        l += line.strip(),
    print(mergeex(l))

if __name__ == '__main__':
    from fileinput import input as fileinput
    main()
