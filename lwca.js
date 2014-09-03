// LWCA - Latent Wiki Category Allocation
// JavaScript implementation
// mruttley - 2014-08-27

function getHistory(){
	//Generator that yields the most recent history urls
	
	//create the history service
	var historyService = Cc["@mozilla.org/browser/nav-history-service;1"].getService(Ci.nsINavHistoryService);

	//make a blank query
	var options = historyService.getNewQueryOptions();
	var query = historyService.getNewQuery();
	var result = historyService.executeQuery(query, options);

	//open up the results
	var cont = result.root;
	cont.containerOpen = true;
	
	//yield whatever there is
	for(var i=0; i < cont.childCount; i++){
		var node = cont.getChild(i);
		yield node.uri;
	}
	
	//close the results container
	cont.containerOpen = false;
}

function getDomain(url) {
	//returns the (sub)domain of a url
	if (url.indexOf("://") != -1) {
		url = url.split("://")[1]
		if (url.indexOf("/") != -1) {
			url = url.split("/")[0]
		}
		if (url.indexOf("?") != -1) {
			url = url.split("?")[0]
		}
	}else{
		return False
	}
	return url
}

function longest_common_ngram_suffix(s1, s2){
	//Does what it says on the tin
	s1 = s1.split(" ")
	s2 = s2.split(" ")
	min_len = s1.length < s2.length ? s1.length : s2.length
	
	result = false
	for (x=1;x<min_len+1;x++){
		if (s1[s1.length-x] != s2[s2.length-x]) {
			result = s1.slice(s1.length-x+1)
		}
	}
	
	if (result==false) {
		return false
	}else if (result==[]) {
		return false
	}else{
		return result.join(" ")
	}
}

String.prototype.endsWith = function(suffix) {
	//http://stackoverflow.com/a/2548133/849354
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

function remove_persistent_title_components(sessions){
	//Removes common title endings such as " - Google Search"
	//Expects a list of lists of lists:
	// [session, session, session] where each session is a list of [url, title, timstamp]
	//Returns the same, but with better titles
	
	domain_titles = {}
	domain_suffixes = {}
	
	for (let session of sessions) {
		for (let visit of session){
			domain = getDomain(visit[0])
			if (domain_titles.hasOwnProperty(domain)==false) {
				domain_titles[domain] = []
			}
			domain_titles[domain].push(visit[1])
		}		
	}
	
	//what are the most common suffixes?
	for (let domain in domain_titles){
		suffixes = {}
		titles = domain_titles[domain]
		for (x=0;x<titles.length;x++){
			for (y=x;y<titles.length;y++){
				if (x!=y) {
					lcns = longest_common_ngram_suffix(titles[x], titles[x+1])
					if (lcns!=false) {
						if (suffixes.hasOwnProperty(lcns) == false) {
							suffixes[lcns] = 0
						}
						suffixes[lcns] += 1
					}
				}
			}
		}
		//eliminate those that only appear once 
		to_add = {}
		for (let suffix in suffixes) {
			count = suffixes[suffix]
			if (count > 1) {
				to_add[suffix] = 0 //will be incremented with session existence count later
			}
		}
		domain_suffixes[domain] = to_add
	}
	
	//delete title components that only appear in one session
	//first need to iterate through all sessions again,
	//noting down the suffix components counts in domain_suffixes
	
	for (let session of sessions) {
		tmp_counts = {}
		for (let visit of session) {
			domain = getDomain(visit[0])
			if (domain_suffixes.hasOwnProperty(domain)) {
				for (let suffix in domain_suffixes[domain]) {
					if (visit[1].endsWith(suffix)) {
						if (tmp_counts.hasOwnProperty(domain) == false) {
							tmp_counts[domain] = {}
						}
						if (tmp_counts[domain].hasOwnProperty(suffix) == false) {
							tmp_counts[domain][suffix] = 0
						}
						tmp_counts[domain][suffix] += 1
						break
					}
				}
			}
		}
		//for each item in tmp_counts, add 1 to the domain suffixes
		for (let domain of tmp_counts) {
			for (let suffix in tmp_counts[domain]) {
				domain_suffixes[domain][suffix] += 1
			}
		}
	}
	
	//now rebuild domain_suffixes with only those that appear in more than one session
	suffixes2 = {}
	for (let domain of domain_suffixes) {
		suffixes2[domain] = {}
		for (let suffix of domain_suffixes[domain]){
			count = domain_suffixes[domain][suffix]
			if (count > 1) {
				suffixes2[domain][suffix] = count
			}
		}
	}
	
	//iterate through again, and remove title components
	for (x=0;x<sessions.length;x++){
		for (y=0;y<x.length;y++) {
			visit = sessions[x][y]
			domain = getDomain(visit[0])
			if (suffixes2.hasOwnProperty(domain)) {
				for (let suffix in suffixes2[domain]) {
					if (visit[1].endsWith(suffix)) {
						//chop suffix from end
						a.slice(0, a.length-b.length)
						sessions[x][y][1] = visit[1].slice(0, visit[1].length-suffix-length)
						break
					}
				}
			}
		}
	}
	
	return sessions
}

function tfidf_matrix(data, counts=false) {
	//Accepts a list of strings or list of count objects
	//Returns a list of objects where each object's keys are assigned scores according to TFIDF
	
	let document_frequencies = {}
	let basic_term_frequency_vectors = {}
	
	//basic frequencies
	if (counts == false) {
		for(let document of data){
			word_frequencies = {}
			for (let word of document.split(" ")) { //need better tokenization
				if (word_frequencies.hasOwnProperty(word)) {
					word_frequencies[word] += 1
				}else{
					word_frequencies[word] = 1
				}
			}
			basic_term_frequency_vectors.push(word_frequencies)
		}
	}else{
		basic_term_frequency_vectors = data 
		data = 0 //clear memory
	}
	
	//document counts
	for (let v of basic_term_frequency_vectors) {
		for (let word in v) {
			if (document_frequencies.hasOwnProperty(word)) {
				document_frequencies[word] += 1
			}else{
				document_frequencies[word] = 1
			}
		}
	}
	
	//idf for each word
	let N = data.length
	let idf = {}
	for (let word in document_frequencies) {
		idf[word] = Math.log(N/document_frequencies[word])
	}
	
	//now final scores for each vector
	tfidf_vectors = []
	while(basic_term_frequency_vectors.length > 0){
		let v = basic_term_frequency_vectors.shift() //pop index 0
		for (let word in v) {
			tf = 1 + Math.log(v[word])
			idf = idf[word]
			v[word] = tf * idf
		}
		tfidf_vectors.push(v)
	}
	return tfidf_vectors
}

function classifySessions(){
	//Main handler function
	//Returns an array of arrays [[], [], ...]
	//Each sub-array like: [start_id, end_id, classification]
	
	console.log("Getting user data...")
	let sessions = getHistory()
	console.log("Cleaning page titles of persistent components...")
	let sessions = remove_persistent_title_components_across_sessions(sessions)
	
	console.log("Reading in wordlist")
	const fileIO = require("sdk/io/file")
	let dict = fileIO.read("dict_no_stopwords.txt")
	let stopwords = {} //interpreted as an object as lookups are O(1) rather than O(n)
	for (let word in dict.split("\n")) {
		stopwords[word] = 1
	}
	
	console.log("Reading in category payload and creating tfidf_matrix per category")
	let payloadfile = fileIO.read("payload.lwca").split("\n")
	
	category_vectors = {}
	df = {}
	for (let line of payloadfile) {
		let line = line.split("\t")
		category = line[0]
		tf = {}
		
		for (x=1;x<line.length;x+=2) { //process logs of each count
			tf[line[x]] = 1 + Math.log(parseInt(line[x+1]))
		}
		
		for (let t in tf){  //process document frequencies
			if (df.hasOwnProperty(t)) {
				df[t] += 1
			}else{
				df[t] = 1
			}
		}
		category_vectors[category] = tf //add to main object
	}
	
	let N = category_vectors.length
	let idf = {} //calculate IDF for each word
	for (let word in df) {
		idf[word] = Math.log(N/df[word])
	}
	df = 0 //clear memory
	
	let category_tfidf = {}
	for (let category in category_vectors) {
		let vector = category_vectors[category]
		for (let word in vector) {
			let tf = vector[word]
			let word_idf = idf[word]
			vector[word] = tf * word_idf
		}
		category_tfidf[category] = vector
	}
	
	category_vectors = 0 //clear memory
	idf = 0
	
	//now calculate tfidf for sessions
	console.log("converting sessions to tfidf")
	
	session_tf = {}
	df = {}
	for (let session_number of sessions) {
		let session = sessions[session_number]
		let tf = {}
		for (let word in session.split(" ")) { // TODO: better tokenization than this
			if (tf.hasOwnProperty(word)) {
				tf[word] += 1
			}else{
				tf[word] = 1
			}
		}
		session_tf["session_" + session_number] = tf
		for (let word in tf){
			if (df.hasOwnProperty(word)) {
				df[word] += 1
			}else{
				df[word] = 1
			}
		}
	}
	//now get idf
	let N = sessions.length
	let idf = {} //calculate IDF for each word
	for (let word in df) {
		idf[word] = Math.log(N/df[word])
	}
	df = 0 //clear memory
	
	//calculate final tfidf
	let session_tfidf = {}
	for (let session in session_tf) {
		let vector = session_tf[session]
		for (let word in vector) {
			let tf = vector[word]
			let word_idf = idf[word]
			vector[word] = tf * word_idf
		}
		session_tfidf[session] = vector
	}
	
	session_tf = 0 //clear memory
	idf = 0
	
	//now we have two tfidf matrices, session_tfidf and category_tfidf
	//so classify the sessions using the cosine similarity
	
	results = {}
	
	for (let session in session_tfidf) {
		let vector = session_tfidf[session]
		for (let category in category_tfidf) {
			cosine_similarity = 
		}
	}
	
}







//def classify_sessions_to_top_level():
//	"""Uses sklearn to classify sessions to top level cats
//	Test with:
//	from sklearn_test import classify_sessions_to_top_level;a=classify_sessions_to_top_level()
//	"""
//	
//	#get sessions
//	print "Getting user data..."
//	dbloc = find_repositories_on_computer()
//	dbloc = [x for x in dbloc if "Test" in x][0]
//	sessions = sessionized_visit_group_generator(dbloc, 30)
//	print "done."
//	print "Cleaning page titles of persistent components..."
//	sessions = remove_persistent_title_components_across_sessions(sessions)
//	sessions = ["\n".join([y[1] for y in x]) for x in sessions]
//	print "done."
//	
//	session_name_vector = ["session_{0}".format(x) for x in xrange(len(sessions))]
//	
//	#get top level
//	print "Getting top level...",
//	tl_content = []
//	tl_name_vector = []
//	tl_dir = "/Users/mruttley/Documents/2014-07-14 Python User Profile Analysis/firefox-machine-learning/wiki_top_level_text/"
//	for tl_file in listdir(tl_dir):
//		tl_name = tl_file.replace("wiki_top_level_", "")
//		tl_name_vector.append(tl_name)
//		with copen(tl_dir + tl_file, encoding='utf8') as f:
//			tl_content.append(f.read())
//	print "done."
//	
//	print "Concatenating and setting up wordlist...",
//	#now wang them together
//	all_data = sessions + tl_content
//	all_names = session_name_vector + tl_name_vector
//	#get correct wordlist
//	wordlist = []
//	with copen('dictnostops.txt', encoding='utf8') as f:
//		for line in f:
//			wordlist.append(line[:-1])
//	wordlist = set(wordlist)
//	print "Done."
//	
//	
//	#clean the data
//	print "Cleaning data...",
//	new_all_data = []
//	for bow in all_data:
//		bow = findall("[a-z]{3,}", bow.lower())
//		new_bow = []
//		for word in bow:
//			if len(word) > 2:
//				if not word.isdigit():
//					if word in wordlist:
//						new_bow.append(word)
//		new_all_data.append(" ".join(new_bow))
//	print "done.'"
//	
//	#transform into matrix
//	print "Transforming into matrix...",
//	tfidf = TfidfVectorizer().fit_transform(new_all_data)
//	print "done"
//
//	#now compare each session to the top_levels
//	print "Calculating cosine similarities of sessions to top-level IAB"
//	to_return = []
//	for n, doc_name in enumerate(all_names):
//		if "session" in doc_name:
//			print "Calculating score for: {0}".format(doc_name)
//			common = Counter(new_all_data[n].split()).most_common(100)
//			print "Looks like: {0}".format(common[:15] if len(common) > 14 else common)
//			cosine_similarities = linear_kernel(tfidf[n], tfidf).flatten()
//			related_document_indices = cosine_similarities.argsort()[:-50:-1] #names
//			cs_scores = cosine_similarities[related_document_indices] #scores
//			
//			scores = []
//			for z, x in enumerate(related_document_indices):
//				match_name = all_names[x]
//				score = cs_scores[z]
//				scores.append([match_name, score])
//			
//			scores = sorted(scores, key=lambda x: x[1], reverse=True)
//			tl_scores = [x for x in scores if "session" not in x[0]]
//			print "top match: {0}".format(tl_scores[0] if len(tl_scores) > 0 else "No matches!")
//			
//			
//			to_add = {}
//			#each item in this object is:
//			# session_name : {
//			#	"content": "xyz"
//			#	"top_5_top_level": [[tl1, 10], [tl2, 9], ...]
//			#	"all_scores": [[x, 10], [y, 9], ...]
//			#}
//			
//			#to_add["content"] = new_all_data[n]
//			to_add["KEYWORDS"] = common
//			to_add["CLASSIFICATION"] = "<br>".join([" - ".join([unicode(y) for y in x]) for x in tl_scores[:5]])
//			#to_add["all_scores"] = scores
//			to_add["NUMBER"] = int(doc_name.replace("session_", ""))
//			to_add["PAGEVIEWS"] = all_data[n].count("\n")
//			to_return.append(to_add)
//	
//	html_start = """<html><head><meta charset="UTF-8"> <style>body {font-family: arial;} td, th {border:0.5px solid black;} table {border-collapse: collapse;}</style></head>
//					<body><h1>Session Classifications - LWCA v0.4</h1><form><table>
//					<tr><th>#</th><th>Page views</th><th style="width: 50%;">Top Title Keywords</th><th>Classification</th><th>Accurate?</th></tr>"""
//	row_template = 	"<tr><td>{{NUMBER}}</td><td>{{PAGEVIEWS}}</td><td>{{KEYWORDS}}</td><td>{{CLASSIFICATION}}</td><td>Yes<input type='radio' value='yes'>No<input type='radio' value='no'><td></tr>\n"
//	html_end = """</table></form></body></html>"""
//	
//	print "Formatting and saving to sessions.html...",
//	with copen("sessions.html",'w', encoding='utf8') as f:
//		f.write(html_start)
//		for x in sorted(to_return, key=itemgetter("NUMBER")):
//			tmp_row = row_template
//			for key, value in x.iteritems():
//				tmp_row = tmp_row.replace("{{" + key + "}}", unicode(value))
//			f.write(tmp_row)
//		f.write(html_end)
//	print "done."
//	
//	call(["open", "sessions.html"])